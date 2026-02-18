"""
Search service using Meilisearch for full-text search.
Handles indexing, searching, and autocomplete for books.
"""
from typing import Any
from datetime import datetime
from pydantic import BaseModel, Field

from app.core.meilisearch import (
    get_meili_client,
    BOOKS_INDEX,
    EXTERNAL_BOOKS_INDEX,
)
from app.services.text_extractor import get_text_extractor, TextExtractionError
from app.services.file_service import get_file_service
from app.models.book import Book
from app.models.external_book import ExternalBook


# ============ Response Models ============

class SearchHit(BaseModel):
    """Single search result hit."""
    id: int
    title: str
    author: str | None = None
    description: str | None = None
    cover_url: str | None = None
    category: str | None = None
    language: str | None = None
    published_year: int | None = None
    content_type: str | None = None
    file_size: int | None = None
    source: str = "upload"
    created_at: str | None = None

    # Search-specific fields
    score: float | None = None
    highlights: dict[str, str] = Field(default_factory=dict)


class SearchResponse(BaseModel):
    """Search response with results and metadata."""
    query: str
    hits: list[SearchHit]
    total_hits: int
    processing_time_ms: int
    page: int
    hits_per_page: int
    total_pages: int

    # Facets/filters distribution
    facets: dict[str, dict[str, int]] = Field(default_factory=dict)


class SuggestItem(BaseModel):
    """Autocomplete suggestion item."""
    id: int
    title: str
    author: str | None = None
    category: str | None = None


class SuggestResponse(BaseModel):
    """Autocomplete suggestions response."""
    query: str
    suggestions: list[SuggestItem]
    processing_time_ms: int


# ============ Search Service ============

class SearchService:
    """
    Service for full-text search using Meilisearch.
    Handles indexing, searching, filtering, and autocomplete.
    """

    def __init__(self):
        self._meili = get_meili_client()
        self._text_extractor = get_text_extractor()
        self._file_service = get_file_service()

    # ============ Indexing ============

    async def index_book(
        self,
        book: Book,
        file_content: bytes | None = None,
        extract_text: bool = True,
    ) -> bool:
        """
        Index a book in Meilisearch.

        Args:
            book: Book model instance
            file_content: Optional file content for text extraction
            extract_text: Whether to extract and index text content

        Returns:
            True if indexing was successful
        """
        client = await self._meili.get_async_client()
        index = client.index(BOOKS_INDEX)

        # Prepare document
        document = self._book_to_document(book)

        # Extract text content if enabled and file content provided
        if extract_text and file_content and book.content_type:
            try:
                extraction_result = await self._text_extractor.extract_text(
                    content=file_content,
                    content_type=book.content_type,
                    file_name=book.file_name,
                )
                document["content"] = extraction_result.get("text", "")

                # Update page count from extraction if not set
                if not book.page_count and extraction_result.get("page_count"):
                    document["page_count"] = extraction_result["page_count"]

            except TextExtractionError as e:
                # Log error but continue with indexing without content
                print(f"Text extraction failed for book {book.id}: {e}")
                document["content"] = ""

        # Add to index
        try:
            await index.add_documents([document])
            return True
        except Exception as e:
            print(f"Failed to index book {book.id}: {e}")
            return False

    async def index_book_from_storage(self, book: Book) -> bool:
        """
        Index a book, downloading content from storage if needed.

        Args:
            book: Book model instance

        Returns:
            True if indexing was successful
        """
        # Download file content from MinIO
        file_content = None
        if book.file_path:
            try:
                file_content, _ = await self._file_service.download_file(book.file_path)
            except Exception as e:
                print(f"Failed to download file for book {book.id}: {e}")

        return await self.index_book(book, file_content)

    async def update_book_index(
        self,
        book: Book,
        update_content: bool = False,
        file_content: bytes | None = None,
    ) -> bool:
        """
        Update a book's index entry.

        Args:
            book: Book model instance
            update_content: Whether to re-extract text content
            file_content: Optional new file content

        Returns:
            True if update was successful
        """
        return await self.index_book(
            book,
            file_content if update_content else None,
            extract_text=update_content,
        )

    async def delete_book_from_index(self, book_id: int) -> bool:
        """
        Remove a book from the search index.

        Args:
            book_id: ID of the book to remove

        Returns:
            True if deletion was successful
        """
        client = await self._meili.get_async_client()
        index = client.index(BOOKS_INDEX)

        try:
            await index.delete_document(str(book_id))
            return True
        except Exception as e:
            print(f"Failed to delete book {book_id} from index: {e}")
            return False

    async def index_external_book(self, external_book: ExternalBook) -> bool:
        """Index an external book in Meilisearch."""
        client = await self._meili.get_async_client()
        index = client.index(EXTERNAL_BOOKS_INDEX)

        document = self._external_book_to_document(external_book)

        try:
            await index.add_documents([document])
            return True
        except Exception as e:
            print(f"Failed to index external book {external_book.id}: {e}")
            return False

    async def delete_external_book_from_index(self, external_book_id: int) -> bool:
        """Remove an external book from the search index."""
        client = await self._meili.get_async_client()
        index = client.index(EXTERNAL_BOOKS_INDEX)

        try:
            await index.delete_document(str(external_book_id))
            return True
        except Exception as e:
            print(f"Failed to delete external book {external_book_id} from index: {e}")
            return False

    # ============ Searching ============

    async def search(
        self,
        query: str,
        page: int = 1,
        hits_per_page: int = 20,
        filters: dict[str, Any] | None = None,
        sort: list[str] | None = None,
        include_external: bool = False,
    ) -> SearchResponse:
        """
        Search for books using Meilisearch.

        Args:
            query: Search query string
            page: Page number (1-indexed)
            hits_per_page: Number of results per page
            filters: Optional filters (author, category, language, etc.)
            sort: Optional sort fields (e.g., ["published_year:desc"])
            include_external: Whether to include external books in results

        Returns:
            SearchResponse with results and metadata
        """
        client = await self._meili.get_async_client()
        index = client.index(BOOKS_INDEX)

        # Build filter string
        filter_str = self._build_filter_string(filters) if filters else None

        # Configure search options
        search_params = {
            "q": query,
            "page": page,
            "hits_per_page": hits_per_page,
            "attributes_to_highlight": ["title", "author", "description", "content"],
            "highlight_pre_tag": "<mark>",
            "highlight_post_tag": "</mark>",
            "attributes_to_crop": ["content"],
            "crop_length": 200,
            "show_matches_position": False,
            "facets": ["author", "category", "language", "content_type", "published_year"],
        }

        if filter_str:
            search_params["filter"] = filter_str

        if sort:
            search_params["sort"] = sort

        # Execute search
        result = await index.search(**search_params)

        # Parse hits
        hits = []
        for hit in result.hits:
            highlights = {}
            if hasattr(result, '_formatted') and hit.get('_formatted'):
                formatted = hit['_formatted']
                for field in ["title", "author", "description", "content"]:
                    if formatted.get(field) and '<mark>' in formatted[field]:
                        highlights[field] = formatted[field]

            hits.append(SearchHit(
                id=hit["id"],
                title=hit.get("title", ""),
                author=hit.get("author"),
                description=hit.get("description"),
                cover_url=hit.get("cover_url"),
                category=hit.get("category"),
                language=hit.get("language"),
                published_year=hit.get("published_year"),
                content_type=hit.get("content_type"),
                file_size=hit.get("file_size"),
                source=hit.get("source", "upload"),
                created_at=hit.get("created_at"),
                score=hit.get("_rankingScore"),
                highlights=highlights,
            ))

        # Parse facets
        facets = {}
        if hasattr(result, 'facet_distribution') and result.facet_distribution:
            facets = result.facet_distribution

        # Calculate pagination
        total_hits = result.estimated_total_hits or len(hits)
        total_pages = (total_hits + hits_per_page - 1) // hits_per_page

        return SearchResponse(
            query=query,
            hits=hits,
            total_hits=total_hits,
            processing_time_ms=result.processing_time_ms,
            page=page,
            hits_per_page=hits_per_page,
            total_pages=total_pages,
            facets=facets,
        )

    async def suggest(
        self,
        query: str,
        limit: int = 5,
    ) -> SuggestResponse:
        """
        Get autocomplete suggestions for a query.

        Args:
            query: Partial query string
            limit: Maximum number of suggestions

        Returns:
            SuggestResponse with suggestions
        """
        client = await self._meili.get_async_client()
        index = client.index(BOOKS_INDEX)

        # Search with limited attributes
        result = await index.search(
            query,
            limit=limit,
            attributes_to_retrieve=["id", "title", "author", "category"],
        )

        suggestions = [
            SuggestItem(
                id=hit["id"],
                title=hit.get("title", ""),
                author=hit.get("author"),
                category=hit.get("category"),
            )
            for hit in result.hits
        ]

        return SuggestResponse(
            query=query,
            suggestions=suggestions,
            processing_time_ms=result.processing_time_ms,
        )

    async def get_similar_books(
        self,
        book_id: int,
        limit: int = 5,
    ) -> list[SearchHit]:
        """
        Find books similar to a given book.

        Args:
            book_id: ID of the reference book
            limit: Maximum number of similar books

        Returns:
            List of similar books
        """
        client = await self._meili.get_async_client()
        index = client.index(BOOKS_INDEX)

        # First get the book's details
        try:
            book_doc = await index.get_document(str(book_id))
        except Exception:
            return []

        # Build a query from the book's attributes
        query_parts = []
        if book_doc.get("title"):
            query_parts.append(book_doc["title"])
        if book_doc.get("author"):
            query_parts.append(book_doc["author"])
        if book_doc.get("category"):
            query_parts.append(book_doc["category"])

        if not query_parts:
            return []

        query = " ".join(query_parts[:2])  # Use title and author

        # Search for similar, excluding the original book
        result = await index.search(
            query,
            limit=limit + 1,  # Get extra in case original is in results
            filter=f"id != {book_id}",
        )

        hits = []
        for hit in result.hits[:limit]:
            hits.append(SearchHit(
                id=hit["id"],
                title=hit.get("title", ""),
                author=hit.get("author"),
                description=hit.get("description"),
                cover_url=hit.get("cover_url"),
                category=hit.get("category"),
                language=hit.get("language"),
                published_year=hit.get("published_year"),
                content_type=hit.get("content_type"),
                source=hit.get("source", "upload"),
            ))

        return hits

    # ============ Bulk Operations ============

    async def reindex_all_books(self, books: list[Book]) -> dict[str, int]:
        """
        Reindex all books (for maintenance/rebuild).

        Args:
            books: List of Book models to index

        Returns:
            Dictionary with success/failure counts
        """
        client = await self._meili.get_async_client()
        index = client.index(BOOKS_INDEX)

        # Clear existing index
        await index.delete_all_documents()

        # Prepare documents
        documents = [self._book_to_document(book) for book in books]

        # Add in batches
        batch_size = 100
        success_count = 0
        failure_count = 0

        for i in range(0, len(documents), batch_size):
            batch = documents[i:i + batch_size]
            try:
                await index.add_documents(batch)
                success_count += len(batch)
            except Exception as e:
                print(f"Batch indexing failed: {e}")
                failure_count += len(batch)

        return {
            "indexed": success_count,
            "failed": failure_count,
            "total": len(documents),
        }

    async def get_index_stats(self) -> dict[str, Any]:
        """Get search index statistics."""
        return await self._meili.get_index_stats(BOOKS_INDEX)

    # ============ Helper Methods ============

    def _book_to_document(self, book: Book) -> dict[str, Any]:
        """Convert Book model to Meilisearch document."""
        return {
            "id": book.id,
            "title": book.title,
            "author": book.author,
            "description": book.description,
            "isbn": book.isbn,
            "publisher": book.publisher,
            "published_year": book.published_year,
            "language": book.language,
            "category": book.category,
            "cover_url": book.cover_path,  # Will be converted to URL
            "content_type": book.content_type,
            "file_size": book.file_size,
            "source": "upload",
            "uploaded_by_id": book.uploaded_by_id,
            "created_at": book.created_at.isoformat() if book.created_at else None,
            "content": "",  # Will be filled by text extraction
        }

    def _external_book_to_document(self, book: ExternalBook) -> dict[str, Any]:
        """Convert ExternalBook model to Meilisearch document."""
        return {
            "id": book.id,
            "title": book.title,
            "authors": book.authors or [],
            "description": book.description,
            "isbn_10": book.isbn_10,
            "isbn_13": book.isbn_13,
            "publisher": book.publisher,
            "published_year": book.published_year,
            "language": book.language,
            "categories": book.categories or [],
            "cover_url": book.cover_url,
            "source": book.source,
            "is_imported": book.is_imported,
            "average_rating": book.average_rating,
            "created_at": book.created_at.isoformat() if book.created_at else None,
        }

    def _build_filter_string(self, filters: dict[str, Any]) -> str:
        """Build Meilisearch filter string from filter dict."""
        conditions = []

        for key, value in filters.items():
            if value is None:
                continue

            if key in ["author", "category", "language", "content_type", "source"]:
                # String equality filter
                conditions.append(f'{key} = "{value}"')

            elif key == "published_year":
                # Can be a single year or range
                if isinstance(value, dict):
                    if value.get("min"):
                        conditions.append(f"published_year >= {value['min']}")
                    if value.get("max"):
                        conditions.append(f"published_year <= {value['max']}")
                else:
                    conditions.append(f"published_year = {value}")

            elif key == "uploaded_by_id":
                conditions.append(f"uploaded_by_id = {value}")

        return " AND ".join(conditions) if conditions else ""


# Singleton instance
_search_service: SearchService | None = None


def get_search_service() -> SearchService:
    """Get singleton SearchService instance."""
    global _search_service
    if _search_service is None:
        _search_service = SearchService()
    return _search_service
