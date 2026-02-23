"""
Book management endpoints.
"""
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response, StreamingResponse
from loguru import logger
import io
import chardet

from app.crud.book import book_crud
from app.schemas.book import (
    BookCreate,
    BookListResponse,
    BookResponse,
    BookUpdate,
    BookFileResponse,
    BookHtmlResponse,
)
from app.services.auth import CurrentUser, DBSession, OptionalCurrentUser
from app.services.file_service import file_service
from app.services.search_service import get_search_service
from app.services.docx_converter import get_docx_converter, ConversionError

router = APIRouter()


def detect_and_convert_to_utf8(content: bytes) -> tuple[bytes, str]:
    """
    Detect encoding of text content and convert to UTF-8.

    Returns:
        Tuple of (utf8_content, detected_encoding)
    """
    # Try to detect encoding
    detection = chardet.detect(content)
    detected_encoding = detection.get("encoding") or "utf-8"
    confidence = detection.get("confidence", 0)

    logger.debug(f"Detected encoding: {detected_encoding} (confidence: {confidence})")

    # If already UTF-8 or ASCII, return as-is
    if detected_encoding.lower() in ("utf-8", "ascii"):
        return content, "utf-8"

    # Try to decode and re-encode as UTF-8
    try:
        text = content.decode(detected_encoding)
        return text.encode("utf-8"), "utf-8"
    except (UnicodeDecodeError, LookupError) as e:
        logger.warning(f"Failed to convert from {detected_encoding}: {e}")

        # Fallback: try common encodings
        for encoding in ["utf-8", "cp1251", "cp1252", "latin-1"]:
            try:
                text = content.decode(encoding)
                return text.encode("utf-8"), "utf-8"
            except UnicodeDecodeError:
                continue

        # Last resort: return original with replacement characters
        text = content.decode("utf-8", errors="replace")
        return text.encode("utf-8"), "utf-8"


def make_content_disposition(disposition: str, filename: str) -> str:
    """
    Create a Content-Disposition header with proper encoding for non-ASCII filenames.

    Uses RFC 5987 filename* parameter for Unicode support.
    """
    # Create ASCII-safe fallback filename
    ascii_filename = filename.encode("ascii", errors="replace").decode("ascii").replace("?", "_")

    # URL-encode the original filename for filename*
    encoded_filename = quote(filename)

    # Return both filename (for old browsers) and filename* (for modern browsers)
    return f'{disposition}; filename="{ascii_filename}"; filename*=UTF-8\'\'{encoded_filename}'


@router.post("/", response_model=BookResponse, status_code=status.HTTP_201_CREATED)
async def upload_book(
    db: DBSession,
    current_user: CurrentUser,
    background_tasks: BackgroundTasks,
    file: Annotated[UploadFile, File(description="Book file (PDF, EPUB, TXT, DOCX)")],
    title: Annotated[str, Form()],
    author: Annotated[str | None, Form()] = None,
    description: Annotated[str | None, Form()] = None,
    isbn: Annotated[str | None, Form()] = None,
    publisher: Annotated[str | None, Form()] = None,
    published_year: Annotated[int | None, Form()] = None,
    language: Annotated[str | None, Form()] = None,
    category: Annotated[str | None, Form()] = None,
):
    """
    Upload a new book.

    Accepts multipart/form-data with:
    - **file**: Book file (PDF, EPUB, TXT, DOCX)
    - **title**: Book title (required)
    - **author**: Book author
    - **description**: Book description
    - **isbn**: ISBN number
    - **publisher**: Publisher name
    - **published_year**: Year of publication
    - **language**: Language code (e.g., 'ru', 'en')
    - **category**: Book category

    The book will be automatically indexed for full-text search.
    """
    # Read file content for indexing
    file_content = await file.read()
    await file.seek(0)  # Reset for upload

    # Upload file to MinIO with validation
    upload_result = await file_service.upload_file(file, prefix="books", validate=True)

    # Create book record
    book_data = BookCreate(
        title=title,
        author=author,
        description=description,
        isbn=isbn,
        publisher=publisher,
        published_year=published_year,
        language=language,
        category=category,
    )

    book = await book_crud.create_with_file(
        db,
        obj_in=book_data,
        file_path=upload_result.object_name,
        file_name=upload_result.original_filename,
        file_size=upload_result.file_size,
        content_type=upload_result.content_type,
        uploaded_by_id=current_user.id,
    )

    # Index book for search in background
    async def index_book_task():
        try:
            search_service = get_search_service()
            await search_service.index_book(book, file_content, extract_text=True)
            logger.info(f"Successfully indexed book {book.id}")
        except Exception as e:
            logger.error(f"Failed to index book {book.id}: {e}")

    background_tasks.add_task(index_book_task)

    # Generate download URL
    download_url = await file_service.get_download_url(
        book.file_path,
        filename=book.file_name,
    )

    # Return response with download URL
    response = BookResponse.model_validate(book)
    response.download_url = download_url
    return response


@router.get("/", response_model=BookListResponse)
async def get_books(
    db: DBSession,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    category: str | None = None,
    author: str | None = None,
    language: str | None = None,
    year_from: Annotated[int | None, Query(ge=1000)] = None,
    year_to: Annotated[int | None, Query(le=2100)] = None,
):
    """
    Get list of all books with pagination.

    - **skip**: Number of records to skip (default: 0)
    - **limit**: Maximum number of records (default: 20, max: 100)
    - **category**: Filter by category
    - **author**: Filter by author
    - **language**: Filter by language
    - **year_from**: Filter by publication year (minimum)
    - **year_to**: Filter by publication year (maximum)
    """
    # Get books with optional filters
    if category or author or language or year_from or year_to:
        # Use search with empty query for filtering
        books, total = await book_crud.search(
            db,
            query="",
            category=category,
            author=author,
            language=language,
            year_from=year_from,
            year_to=year_to,
            skip=skip,
            limit=limit,
        )
    else:
        books = await book_crud.get_multi(db, skip=skip, limit=limit)
        total = await book_crud.count(db)

    # Generate download URLs
    items = []
    for book in books:
        response = BookResponse.model_validate(book)
        try:
            response.download_url = await file_service.get_file_url(book.file_path)
        except Exception:
            response.download_url = None
        items.append(response)

    return BookListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
        has_more=(skip + len(items)) < total,
    )


@router.get("/my", response_model=BookListResponse)
async def get_my_books(
    db: DBSession,
    current_user: CurrentUser,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """
    Get books uploaded by current user.
    """
    books = await book_crud.get_multi_by_user(
        db,
        user_id=current_user.id,
        skip=skip,
        limit=limit,
    )
    total = await book_crud.count_by_user(db, current_user.id)

    items = []
    for book in books:
        response = BookResponse.model_validate(book)
        try:
            response.download_url = await file_service.get_file_url(book.file_path)
        except Exception:
            response.download_url = None
        items.append(response)

    return BookListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
        has_more=(skip + len(items)) < total,
    )


@router.get("/categories", response_model=list[str])
async def get_categories(db: DBSession):
    """
    Get list of all book categories.
    """
    categories = await book_crud.get_categories(db)
    return list(categories)


@router.get("/languages", response_model=list[str])
async def get_languages(db: DBSession):
    """
    Get list of all book languages.
    """
    languages = await book_crud.get_languages(db)
    return list(languages)


@router.get("/{book_id}", response_model=BookResponse)
async def get_book(
    book_id: int,
    db: DBSession,
):
    """
    Get book by ID.
    """
    book = await book_crud.get(db, id=book_id)
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    response = BookResponse.model_validate(book)
    try:
        response.download_url = await file_service.get_file_url(book.file_path)
    except Exception:
        response.download_url = None

    return response


@router.get("/{book_id}/file", response_model=BookFileResponse)
async def get_book_file(
    book_id: int,
    db: DBSession,
    download: bool = Query(False, description="Force download instead of inline view"),
):
    """
    Get book file URL or download the file directly.

    - **download**: If true, returns a download URL with Content-Disposition header
    - Returns presigned URL valid for 1 hour
    """
    book = await book_crud.get(db, id=book_id)
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    try:
        if download:
            # Return URL with download header
            url = await file_service.get_download_url(
                book.file_path,
                filename=book.file_name,
            )
        else:
            # Return URL for inline viewing
            url = await file_service.get_file_url(book.file_path)

        return BookFileResponse(
            url=url,
            file_name=book.file_name,
            file_size=book.file_size,
            content_type=book.content_type,
        )

    except Exception as e:
        logger.error(f"Failed to get file URL for book {book_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        )


@router.get("/{book_id}/file/stream")
async def stream_book_file(
    book_id: int,
    db: DBSession,
    download: bool = Query(False, description="Force download with attachment disposition"),
):
    """
    Stream book file content directly (for embedded viewers).

    Returns the file content with appropriate headers for browser viewing.
    Automatically handles encoding for text files.

    - **download**: If true, forces browser to download the file instead of displaying it
    """
    book = await book_crud.get(db, id=book_id)
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    try:
        content, content_type = await file_service.download_file(book.file_path)

        # For text files, detect encoding and convert to UTF-8
        if content_type == "text/plain" or (book.file_name and book.file_name.lower().endswith(".txt")):
            content, _ = detect_and_convert_to_utf8(content)
            content_type = "text/plain; charset=utf-8"

        # Create safe Content-Disposition header
        # Use "attachment" for download, "inline" for preview
        disposition = "attachment" if download else "inline"
        content_disposition = make_content_disposition(disposition, book.file_name)

        return StreamingResponse(
            io.BytesIO(content),
            media_type=content_type,
            headers={
                "Content-Disposition": content_disposition,
                "Content-Length": str(len(content)),
                "Accept-Ranges": "bytes",
            },
        )

    except Exception as e:
        logger.error(f"Failed to stream file for book {book_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        )


@router.get("/{book_id}/file/html", response_model=BookHtmlResponse)
async def get_book_html(
    book_id: int,
    db: DBSession,
):
    """
    Get HTML version of DOCX file for preview.

    Converts DOCX files to HTML using mammoth library.
    Preserves formatting including headings, lists, tables, bold, and italic.

    Returns HTML and plain text extracted from the document.
    Only supports DOCX files.
    """
    book = await book_crud.get(db, id=book_id)
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Check if file is DOCX
    is_docx = (
        book.content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        or (book.file_name and book.file_name.lower().endswith(".docx"))
    )

    if not is_docx:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"HTML preview is only available for DOCX files. Got: {book.content_type}",
        )

    try:
        # Download file from MinIO
        file_content, content_type = await file_service.download_file(book.file_path)
        logger.info(f"Downloaded file for book {book_id}: {len(file_content)} bytes, {content_type}")

        # Convert to HTML
        converter = get_docx_converter()
        result = await converter.convert_to_html(file_content)
        logger.info(f"Converted DOCX to HTML for book {book_id}: {len(result['html'])} chars")

        return BookHtmlResponse(
            html=result["html"],
            text=result["text"],
        )

    except ConversionError as e:
        logger.error(f"Failed to convert DOCX to HTML for book {book_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to convert document to HTML",
        )
    except Exception as e:
        logger.error(f"Error getting HTML for book {book_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process document",
        )


@router.patch("/{book_id}", response_model=BookResponse)
async def update_book(
    book_id: int,
    book_update: BookUpdate,
    db: DBSession,
    current_user: CurrentUser,
    background_tasks: BackgroundTasks,
):
    """
    Update book metadata.

    Only the uploader or superuser can update.
    The search index will be updated automatically.
    """
    book = await book_crud.get(db, id=book_id)
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Check permissions
    if book.uploaded_by_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this book",
        )

    updated_book = await book_crud.update(db, db_obj=book, obj_in=book_update)

    # Update search index in background
    async def update_index_task():
        try:
            search_service = get_search_service()
            await search_service.update_book_index(updated_book, update_content=False)
            logger.info(f"Successfully updated index for book {book_id}")
        except Exception as e:
            logger.error(f"Failed to update index for book {book_id}: {e}")

    background_tasks.add_task(update_index_task)

    response = BookResponse.model_validate(updated_book)
    try:
        response.download_url = await file_service.get_file_url(updated_book.file_path)
    except Exception:
        response.download_url = None

    return response


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book(
    book_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Delete a book.

    Only the uploader or superuser can delete.
    Also removes the file from storage and search index.
    """
    book = await book_crud.get(db, id=book_id)
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Check permissions
    if book.uploaded_by_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this book",
        )

    # Delete from search index
    try:
        search_service = get_search_service()
        await search_service.delete_book_from_index(book_id)
        logger.info(f"Removed book {book_id} from search index")
    except Exception as e:
        logger.warning(f"Failed to remove book {book_id} from search index: {e}")

    # Delete file from storage
    try:
        await file_service.delete_file(book.file_path)
        if book.cover_path:
            await file_service.delete_file(book.cover_path)
    except Exception as e:
        logger.warning(f"Failed to delete file from storage: {e}")

    # Delete from database
    await book_crud.delete(db, id=book_id)
