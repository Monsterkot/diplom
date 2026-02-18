"""
API endpoints for external book search and import.
"""
from fastapi import APIRouter, Query, HTTPException, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime
from typing import Annotated

from app.core.database import get_db
from app.models.external_book import ExternalBook
from app.schemas.external_book import (
    ExternalSourceEnum,
    ExternalBookSearchResult,
    ExternalSearchResponse,
    MultiSourceSearchResponse,
    ExternalBookImportRequest,
    BulkImportRequest,
    ImportResult,
    BulkImportResponse,
    ExternalBookResponse,
    ExternalBookListResponse,
    ExternalSourceInfo,
    SourcesListResponse,
)
from app.services.external_apis import (
    get_external_apis_service,
    ExternalAPIError,
    ExternalSource,
    ExternalBookResult,
)
from app.services.auth import CurrentUser, OptionalCurrentUser

router = APIRouter(prefix="/external", tags=["external"])

# Type alias for database session
DBSession = Annotated[AsyncSession, Depends(get_db)]


# ============ Sources Endpoint ============

@router.get("/sources", response_model=SourcesListResponse)
async def get_sources():
    """
    Get list of available external book sources.

    Returns information about each source including:
    - Name and description
    - Available features
    - Rate limits
    - API key status
    """
    service = get_external_apis_service()
    sources_info = service.get_available_sources()

    sources = [
        ExternalSourceInfo(
            id=s["id"],
            name=s["name"],
            description=s["description"],
            features=s["features"],
            rate_limit=s["rate_limit"],
            has_api_key=s["has_api_key"],
            is_available=True,
        )
        for s in sources_info
    ]

    return SourcesListResponse(sources=sources)


# ============ Search Endpoints ============

@router.get("/search", response_model=MultiSourceSearchResponse)
async def search_external_books(
    db: DBSession,
    q: str = Query(..., min_length=1, description="Search query"),
    source: ExternalSourceEnum | None = Query(None, description="Specific source to search"),
    limit: int = Query(10, ge=1, le=40, description="Maximum results per source"),
):
    """
    Search for books in external sources.

    Searches Google Books and Open Library APIs for matching books.
    Results include import status if the book has already been cached.
    """
    service = get_external_apis_service()

    # Determine which sources to search
    sources = None
    if source:
        sources = [ExternalSource(source.value)]

    # Perform search
    try:
        results = await service.search_all_sources(
            query=q,
            max_results_per_source=limit,
            sources=sources,
        )
    except ExternalAPIError as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Check import status for results
    response_results = {}
    total_items = 0
    total_time = 0

    for src, search_response in results.items():
        # Get external IDs for this source
        external_ids = [item.external_id for item in search_response.items]

        # Query database for existing imports
        imported_map = {}
        if external_ids:
            stmt = select(ExternalBook.external_id, ExternalBook.is_imported, ExternalBook.imported_book_id).where(
                and_(
                    ExternalBook.source == src.value,
                    ExternalBook.external_id.in_(external_ids)
                )
            )
            result = await db.execute(stmt)
            for row in result:
                imported_map[row.external_id] = {
                    "is_imported": row.is_imported,
                    "imported_book_id": row.imported_book_id,
                }

        # Build response items with import status
        items = []
        for item in search_response.items:
            import_info = imported_map.get(item.external_id, {})
            items.append(ExternalBookSearchResult(
                external_id=item.external_id,
                source=ExternalSourceEnum(item.source.value),
                title=item.title,
                authors=item.authors,
                description=item.description,
                isbn_10=item.isbn_10,
                isbn_13=item.isbn_13,
                publisher=item.publisher,
                published_date=item.published_date,
                page_count=item.page_count,
                categories=item.categories,
                language=item.language,
                thumbnail_url=item.thumbnail_url,
                preview_link=item.preview_link,
                info_link=item.info_link,
                average_rating=item.average_rating,
                ratings_count=item.ratings_count,
                is_imported=import_info.get("is_imported", False),
                imported_book_id=import_info.get("imported_book_id"),
            ))

        response_results[src.value] = ExternalSearchResponse(
            source=ExternalSourceEnum(src.value),
            query=q,
            total_items=search_response.total_items,
            items=items,
            search_time_ms=search_response.search_time_ms,
        )

        total_items += search_response.total_items
        total_time += search_response.search_time_ms

    return MultiSourceSearchResponse(
        query=q,
        results=response_results,
        total_items=total_items,
        total_search_time_ms=total_time,
    )


@router.get("/search/{source}", response_model=ExternalSearchResponse)
async def search_single_source(
    db: DBSession,
    source: ExternalSourceEnum,
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(10, ge=1, le=40, description="Maximum results"),
    offset: int = Query(0, ge=0, description="Results offset for pagination"),
):
    """
    Search for books in a specific external source.
    """
    service = get_external_apis_service()

    try:
        if source == ExternalSourceEnum.GOOGLE_BOOKS:
            search_response = await service.search_google_books(q, limit, offset)
        elif source == ExternalSourceEnum.OPEN_LIBRARY:
            page = (offset // limit) + 1 if limit > 0 else 1
            search_response = await service.search_open_library(q, limit, page)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported source: {source}")
    except ExternalAPIError as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Check import status
    external_ids = [item.external_id for item in search_response.items]
    imported_map = {}
    if external_ids:
        stmt = select(ExternalBook.external_id, ExternalBook.is_imported, ExternalBook.imported_book_id).where(
            and_(
                ExternalBook.source == source.value,
                ExternalBook.external_id.in_(external_ids)
            )
        )
        result = await db.execute(stmt)
        for row in result:
            imported_map[row.external_id] = {
                "is_imported": row.is_imported,
                "imported_book_id": row.imported_book_id,
            }

    # Build response
    items = []
    for item in search_response.items:
        import_info = imported_map.get(item.external_id, {})
        items.append(ExternalBookSearchResult(
            external_id=item.external_id,
            source=ExternalSourceEnum(item.source.value),
            title=item.title,
            authors=item.authors,
            description=item.description,
            isbn_10=item.isbn_10,
            isbn_13=item.isbn_13,
            publisher=item.publisher,
            published_date=item.published_date,
            page_count=item.page_count,
            categories=item.categories,
            language=item.language,
            thumbnail_url=item.thumbnail_url,
            preview_link=item.preview_link,
            info_link=item.info_link,
            average_rating=item.average_rating,
            ratings_count=item.ratings_count,
            is_imported=import_info.get("is_imported", False),
            imported_book_id=import_info.get("imported_book_id"),
        ))

    return ExternalSearchResponse(
        source=source,
        query=q,
        total_items=search_response.total_items,
        items=items,
        search_time_ms=search_response.search_time_ms,
    )


# ============ Details Endpoint ============

@router.get("/details/{source}/{external_id}", response_model=ExternalBookSearchResult)
async def get_book_details(
    db: DBSession,
    source: ExternalSourceEnum,
    external_id: str,
):
    """
    Get detailed information about a specific external book.
    """
    service = get_external_apis_service()

    try:
        if source == ExternalSourceEnum.GOOGLE_BOOKS:
            book_data = await service.get_google_book_details(external_id)
        elif source == ExternalSourceEnum.OPEN_LIBRARY:
            book_data = await service.get_open_library_book_details(external_id)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported source: {source}")
    except ExternalAPIError as e:
        if e.status_code == 404:
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=503, detail=str(e))

    # Check import status
    stmt = select(ExternalBook).where(
        and_(
            ExternalBook.source == source.value,
            ExternalBook.external_id == external_id
        )
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    return ExternalBookSearchResult(
        external_id=book_data.external_id,
        source=ExternalSourceEnum(book_data.source.value),
        title=book_data.title,
        authors=book_data.authors,
        description=book_data.description,
        isbn_10=book_data.isbn_10,
        isbn_13=book_data.isbn_13,
        publisher=book_data.publisher,
        published_date=book_data.published_date,
        page_count=book_data.page_count,
        categories=book_data.categories,
        language=book_data.language,
        thumbnail_url=book_data.thumbnail_url,
        preview_link=book_data.preview_link,
        info_link=book_data.info_link,
        average_rating=book_data.average_rating,
        ratings_count=book_data.ratings_count,
        is_imported=existing.is_imported if existing else False,
        imported_book_id=existing.imported_book_id if existing else None,
    )


# ============ Import Endpoints ============

@router.post("/import", response_model=ImportResult)
async def import_external_book(
    db: DBSession,
    current_user: CurrentUser,
    request: ExternalBookImportRequest,
):
    """
    Import a book from external source to local library.

    This caches the book metadata in the local database for faster access.
    The book can later be linked to an uploaded file.
    """
    service = get_external_apis_service()

    # Check if already imported
    stmt = select(ExternalBook).where(
        and_(
            ExternalBook.source == request.source.value,
            ExternalBook.external_id == request.external_id
        )
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing and existing.is_imported:
        return ImportResult(
            external_id=request.external_id,
            source=request.source,
            success=True,
            message="Book already imported",
            external_book_id=existing.id,
        )

    # Fetch book details from external API
    try:
        if request.source == ExternalSourceEnum.GOOGLE_BOOKS:
            book_data = await service.get_google_book_details(request.external_id)
        elif request.source == ExternalSourceEnum.OPEN_LIBRARY:
            book_data = await service.get_open_library_book_details(request.external_id)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported source: {request.source}")
    except ExternalAPIError as e:
        return ImportResult(
            external_id=request.external_id,
            source=request.source,
            success=False,
            message="Failed to fetch book details",
            error=str(e),
        )

    # Parse published year from date
    published_year = None
    if book_data.published_date:
        try:
            # Try to extract year from various formats
            date_str = book_data.published_date
            if len(date_str) >= 4:
                published_year = int(date_str[:4])
        except (ValueError, TypeError):
            pass

    # Create or update external book record
    if existing:
        # Update existing record
        existing.title = request.title or book_data.title
        existing.authors = book_data.authors
        existing.description = request.description or book_data.description
        existing.cover_url = book_data.thumbnail_url
        existing.published_date = book_data.published_date
        existing.published_year = published_year
        existing.language = request.language or book_data.language
        existing.categories = book_data.categories
        existing.isbn_10 = book_data.isbn_10
        existing.isbn_13 = book_data.isbn_13
        existing.publisher = book_data.publisher
        existing.page_count = book_data.page_count
        existing.average_rating = book_data.average_rating
        existing.ratings_count = book_data.ratings_count
        existing.preview_link = book_data.preview_link
        existing.info_link = book_data.info_link
        existing.metadata_json = book_data.raw_metadata
        existing.is_imported = True
        existing.imported_by_id = current_user.id
        existing.imported_at = datetime.utcnow()
        existing.last_fetched_at = datetime.utcnow()

        await db.commit()
        await db.refresh(existing)
        external_book_id = existing.id
    else:
        # Create new record
        new_book = ExternalBook(
            source=request.source.value,
            external_id=request.external_id,
            title=request.title or book_data.title,
            authors=book_data.authors,
            description=request.description or book_data.description,
            cover_url=book_data.thumbnail_url,
            published_date=book_data.published_date,
            published_year=published_year,
            language=request.language or book_data.language,
            categories=book_data.categories,
            isbn_10=book_data.isbn_10,
            isbn_13=book_data.isbn_13,
            publisher=book_data.publisher,
            page_count=book_data.page_count,
            average_rating=book_data.average_rating,
            ratings_count=book_data.ratings_count,
            preview_link=book_data.preview_link,
            info_link=book_data.info_link,
            metadata_json=book_data.raw_metadata,
            is_imported=True,
            imported_by_id=current_user.id,
            imported_at=datetime.utcnow(),
            last_fetched_at=datetime.utcnow(),
        )

        db.add(new_book)
        await db.commit()
        await db.refresh(new_book)
        external_book_id = new_book.id

    return ImportResult(
        external_id=request.external_id,
        source=request.source,
        success=True,
        message="Book imported successfully",
        external_book_id=external_book_id,
    )


@router.post("/import/bulk", response_model=BulkImportResponse)
async def bulk_import_external_books(
    db: DBSession,
    current_user: CurrentUser,
    request: BulkImportRequest,
    background_tasks: BackgroundTasks,
):
    """
    Import multiple books from external sources.

    For large batches (>10 items), the import is processed asynchronously.
    """
    results = []
    successful = 0
    failed = 0

    # Process imports
    for item in request.items:
        try:
            result = await import_external_book(db, current_user, item)
            results.append(result)
            if result.success:
                successful += 1
            else:
                failed += 1
        except Exception as e:
            results.append(ImportResult(
                external_id=item.external_id,
                source=item.source,
                success=False,
                message="Import failed",
                error=str(e),
            ))
            failed += 1

    return BulkImportResponse(
        total=len(request.items),
        successful=successful,
        failed=failed,
        results=results,
    )


# ============ Cached Books Endpoints ============

@router.get("/cached", response_model=ExternalBookListResponse)
async def get_cached_books(
    db: DBSession,
    source: ExternalSourceEnum | None = Query(None, description="Filter by source"),
    imported_only: bool = Query(False, description="Only show imported books"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """
    Get list of cached external books.
    """
    # Build query
    stmt = select(ExternalBook)

    if source:
        stmt = stmt.where(ExternalBook.source == source.value)

    if imported_only:
        stmt = stmt.where(ExternalBook.is_imported == True)

    # Get total count
    count_stmt = select(ExternalBook.id)
    if source:
        count_stmt = count_stmt.where(ExternalBook.source == source.value)
    if imported_only:
        count_stmt = count_stmt.where(ExternalBook.is_imported == True)

    count_result = await db.execute(count_stmt)
    total = len(count_result.all())

    # Get paginated results
    stmt = stmt.order_by(ExternalBook.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    books = result.scalars().all()

    items = [ExternalBookResponse.model_validate(book) for book in books]

    return ExternalBookListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
        has_more=skip + len(items) < total,
    )


@router.get("/cached/{external_book_id}", response_model=ExternalBookResponse)
async def get_cached_book(
    db: DBSession,
    external_book_id: int,
):
    """
    Get a specific cached external book by ID.
    """
    stmt = select(ExternalBook).where(ExternalBook.id == external_book_id)
    result = await db.execute(stmt)
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(status_code=404, detail="External book not found")

    return ExternalBookResponse.model_validate(book)


@router.delete("/cached/{external_book_id}")
async def delete_cached_book(
    db: DBSession,
    current_user: CurrentUser,
    external_book_id: int,
):
    """
    Delete a cached external book.

    Only the user who imported the book or a superuser can delete it.
    """
    stmt = select(ExternalBook).where(ExternalBook.id == external_book_id)
    result = await db.execute(stmt)
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(status_code=404, detail="External book not found")

    # Check permissions
    if not current_user.is_superuser and book.imported_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this book")

    await db.delete(book)
    await db.commit()

    return {"message": "External book deleted successfully"}
