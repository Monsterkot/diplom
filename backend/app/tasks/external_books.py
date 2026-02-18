"""
Celery tasks for external book operations.
"""
import asyncio
from datetime import datetime, timedelta
from typing import Any
from celery import shared_task
from celery.utils.log import get_task_logger
from sqlalchemy import select, and_
from sqlalchemy.orm import Session

from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.external_book import ExternalBook
from app.services.external_apis import (
    get_external_apis_service,
    ExternalAPIError,
    ExternalSource,
)

logger = get_task_logger(__name__)


def run_async(coro):
    """Helper to run async code in sync context."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    rate_limit="10/m",
)
def import_single_book(
    self,
    source: str,
    external_id: str,
    user_id: int | None = None,
    metadata_overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Import a single book from external source.

    Args:
        source: External source identifier
        external_id: External book ID
        user_id: ID of user initiating the import
        metadata_overrides: Optional metadata to override

    Returns:
        Import result dictionary
    """
    logger.info(f"Importing book {external_id} from {source}")

    try:
        result = run_async(_import_book_async(
            source=source,
            external_id=external_id,
            user_id=user_id,
            metadata_overrides=metadata_overrides,
        ))
        return result
    except ExternalAPIError as e:
        logger.error(f"External API error: {e}")
        if e.status_code == 429:
            # Rate limited - retry with exponential backoff
            raise self.retry(exc=e, countdown=60 * (self.request.retries + 1))
        return {
            "success": False,
            "external_id": external_id,
            "source": source,
            "error": str(e),
        }
    except Exception as e:
        logger.exception(f"Error importing book: {e}")
        return {
            "success": False,
            "external_id": external_id,
            "source": source,
            "error": str(e),
        }


async def _import_book_async(
    source: str,
    external_id: str,
    user_id: int | None,
    metadata_overrides: dict[str, Any] | None,
) -> dict[str, Any]:
    """Async implementation of book import."""
    service = get_external_apis_service()

    # Fetch book details
    if source == "google_books":
        book_data = await service.get_google_book_details(external_id)
    elif source == "open_library":
        book_data = await service.get_open_library_book_details(external_id)
    else:
        raise ValueError(f"Unsupported source: {source}")

    # Parse published year
    published_year = None
    if book_data.published_date:
        try:
            if len(book_data.published_date) >= 4:
                published_year = int(book_data.published_date[:4])
        except (ValueError, TypeError):
            pass

    # Apply overrides
    title = metadata_overrides.get("title") if metadata_overrides else None
    description = metadata_overrides.get("description") if metadata_overrides else None
    language = metadata_overrides.get("language") if metadata_overrides else None

    # Use synchronous session for database operations
    with SessionLocal() as db:
        # Check if already exists
        stmt = select(ExternalBook).where(
            and_(
                ExternalBook.source == source,
                ExternalBook.external_id == external_id
            )
        )
        existing = db.execute(stmt).scalar_one_or_none()

        if existing:
            # Update existing record
            existing.title = title or book_data.title
            existing.authors = book_data.authors
            existing.description = description or book_data.description
            existing.cover_url = book_data.thumbnail_url
            existing.published_date = book_data.published_date
            existing.published_year = published_year
            existing.language = language or book_data.language
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
            existing.imported_by_id = user_id
            existing.imported_at = datetime.utcnow()
            existing.last_fetched_at = datetime.utcnow()

            db.commit()
            db.refresh(existing)
            external_book_id = existing.id
        else:
            # Create new record
            new_book = ExternalBook(
                source=source,
                external_id=external_id,
                title=title or book_data.title,
                authors=book_data.authors,
                description=description or book_data.description,
                cover_url=book_data.thumbnail_url,
                published_date=book_data.published_date,
                published_year=published_year,
                language=language or book_data.language,
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
                imported_by_id=user_id,
                imported_at=datetime.utcnow(),
                last_fetched_at=datetime.utcnow(),
            )

            db.add(new_book)
            db.commit()
            db.refresh(new_book)
            external_book_id = new_book.id

    await service.close()

    return {
        "success": True,
        "external_id": external_id,
        "source": source,
        "external_book_id": external_book_id,
        "message": "Book imported successfully",
    }


@celery_app.task(
    bind=True,
    max_retries=1,
    rate_limit="1/m",
)
def bulk_import_books(
    self,
    items: list[dict[str, Any]],
    user_id: int | None = None,
) -> dict[str, Any]:
    """
    Bulk import multiple books from external sources.

    Args:
        items: List of dicts with 'source' and 'external_id'
        user_id: ID of user initiating the import

    Returns:
        Bulk import result
    """
    logger.info(f"Starting bulk import of {len(items)} books")

    results = []
    successful = 0
    failed = 0

    for i, item in enumerate(items):
        source = item.get("source")
        external_id = item.get("external_id")
        overrides = item.get("overrides")

        logger.info(f"Processing {i + 1}/{len(items)}: {source}/{external_id}")

        # Update task progress
        self.update_state(
            state="PROGRESS",
            meta={
                "current": i + 1,
                "total": len(items),
                "successful": successful,
                "failed": failed,
            }
        )

        try:
            result = run_async(_import_book_async(
                source=source,
                external_id=external_id,
                user_id=user_id,
                metadata_overrides=overrides,
            ))
            results.append(result)
            if result.get("success"):
                successful += 1
            else:
                failed += 1
        except Exception as e:
            logger.error(f"Error importing {external_id}: {e}")
            results.append({
                "success": False,
                "external_id": external_id,
                "source": source,
                "error": str(e),
            })
            failed += 1

        # Small delay to avoid rate limiting
        if i < len(items) - 1:
            asyncio.get_event_loop().run_until_complete(asyncio.sleep(0.5))

    return {
        "total": len(items),
        "successful": successful,
        "failed": failed,
        "results": results,
    }


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    rate_limit="5/m",
)
def update_book_metadata(
    self,
    external_book_id: int,
) -> dict[str, Any]:
    """
    Update metadata for a specific external book.

    Args:
        external_book_id: ID of the external book to update

    Returns:
        Update result
    """
    logger.info(f"Updating metadata for external book {external_book_id}")

    try:
        with SessionLocal() as db:
            book = db.get(ExternalBook, external_book_id)
            if not book:
                return {
                    "success": False,
                    "external_book_id": external_book_id,
                    "error": "Book not found",
                }

            source = book.source
            external_id = book.external_id

        result = run_async(_update_metadata_async(source, external_id, external_book_id))
        return result

    except ExternalAPIError as e:
        logger.error(f"External API error: {e}")
        if e.status_code == 429:
            raise self.retry(exc=e, countdown=60 * (self.request.retries + 1))
        return {
            "success": False,
            "external_book_id": external_book_id,
            "error": str(e),
        }
    except Exception as e:
        logger.exception(f"Error updating metadata: {e}")
        return {
            "success": False,
            "external_book_id": external_book_id,
            "error": str(e),
        }


async def _update_metadata_async(
    source: str,
    external_id: str,
    external_book_id: int,
) -> dict[str, Any]:
    """Async implementation of metadata update."""
    service = get_external_apis_service()

    # Fetch latest data
    if source == "google_books":
        book_data = await service.get_google_book_details(external_id)
    elif source == "open_library":
        book_data = await service.get_open_library_book_details(external_id)
    else:
        raise ValueError(f"Unsupported source: {source}")

    # Parse published year
    published_year = None
    if book_data.published_date:
        try:
            if len(book_data.published_date) >= 4:
                published_year = int(book_data.published_date[:4])
        except (ValueError, TypeError):
            pass

    # Update database
    with SessionLocal() as db:
        book = db.get(ExternalBook, external_book_id)
        if not book:
            return {
                "success": False,
                "external_book_id": external_book_id,
                "error": "Book not found",
            }

        # Update fields
        book.title = book_data.title
        book.authors = book_data.authors
        book.description = book_data.description
        book.cover_url = book_data.thumbnail_url
        book.published_date = book_data.published_date
        book.published_year = published_year
        book.language = book_data.language
        book.categories = book_data.categories
        book.isbn_10 = book_data.isbn_10
        book.isbn_13 = book_data.isbn_13
        book.publisher = book_data.publisher
        book.page_count = book_data.page_count
        book.average_rating = book_data.average_rating
        book.ratings_count = book_data.ratings_count
        book.preview_link = book_data.preview_link
        book.info_link = book_data.info_link
        book.metadata_json = book_data.raw_metadata
        book.last_fetched_at = datetime.utcnow()

        db.commit()

    await service.close()

    return {
        "success": True,
        "external_book_id": external_book_id,
        "message": "Metadata updated successfully",
    }


@celery_app.task(
    bind=True,
    rate_limit="1/h",
)
def update_stale_metadata(
    self,
    max_age_days: int = 7,
    batch_size: int = 50,
) -> dict[str, Any]:
    """
    Update metadata for all books that haven't been updated recently.

    Args:
        max_age_days: Consider books stale after this many days
        batch_size: Number of books to update per run

    Returns:
        Update summary
    """
    logger.info(f"Starting stale metadata update (max_age={max_age_days} days)")

    cutoff_date = datetime.utcnow() - timedelta(days=max_age_days)

    with SessionLocal() as db:
        # Find stale books
        stmt = select(ExternalBook).where(
            ExternalBook.is_imported == True,
            (ExternalBook.last_fetched_at < cutoff_date) | (ExternalBook.last_fetched_at == None)
        ).limit(batch_size)

        stale_books = db.execute(stmt).scalars().all()
        book_ids = [book.id for book in stale_books]

    logger.info(f"Found {len(book_ids)} stale books to update")

    if not book_ids:
        return {
            "total": 0,
            "updated": 0,
            "failed": 0,
            "message": "No stale books found",
        }

    # Queue update tasks for each book
    updated = 0
    failed = 0

    for book_id in book_ids:
        try:
            result = update_book_metadata.delay(book_id)
            updated += 1
        except Exception as e:
            logger.error(f"Failed to queue update for book {book_id}: {e}")
            failed += 1

    return {
        "total": len(book_ids),
        "queued": updated,
        "failed": failed,
        "message": f"Queued {updated} books for metadata update",
    }
