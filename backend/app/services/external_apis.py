"""
External APIs service for book aggregation from external sources.
Supports Google Books API with extensible architecture for other sources.
"""
import asyncio
import httpx
from typing import Any
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field
from functools import lru_cache

from app.core.config import settings


class ExternalSource(str, Enum):
    """Supported external book sources."""
    GOOGLE_BOOKS = "google_books"
    OPEN_LIBRARY = "open_library"


class ExternalBookResult(BaseModel):
    """Unified external book search result."""
    external_id: str
    source: ExternalSource
    title: str
    authors: list[str] = Field(default_factory=list)
    description: str | None = None
    isbn_10: str | None = None
    isbn_13: str | None = None
    publisher: str | None = None
    published_date: str | None = None
    page_count: int | None = None
    categories: list[str] = Field(default_factory=list)
    language: str | None = None
    thumbnail_url: str | None = None
    preview_link: str | None = None
    info_link: str | None = None
    average_rating: float | None = None
    ratings_count: int | None = None
    maturity_rating: str | None = None

    # Raw metadata from source
    raw_metadata: dict[str, Any] = Field(default_factory=dict)


class GoogleBooksMetadata(BaseModel):
    """Google Books specific metadata."""
    google_books_id: str
    etag: str | None = None
    self_link: str | None = None
    volume_info: dict[str, Any] = Field(default_factory=dict)
    sale_info: dict[str, Any] = Field(default_factory=dict)
    access_info: dict[str, Any] = Field(default_factory=dict)
    search_info: dict[str, Any] = Field(default_factory=dict)


class ExternalSearchResponse(BaseModel):
    """Response for external book search."""
    source: ExternalSource
    query: str
    total_items: int
    items: list[ExternalBookResult]
    search_time_ms: int


class ExternalAPIError(Exception):
    """Exception for external API errors."""
    def __init__(self, source: ExternalSource, message: str, status_code: int | None = None):
        self.source = source
        self.message = message
        self.status_code = status_code
        super().__init__(f"{source.value}: {message}")


class ExternalApisService:
    """Service for interacting with external book APIs."""

    # API configuration
    GOOGLE_BOOKS_BASE_URL = "https://www.googleapis.com/books/v1"
    OPEN_LIBRARY_BASE_URL = "https://openlibrary.org"

    # Timeouts and limits
    DEFAULT_TIMEOUT = 10.0  # seconds
    MAX_RESULTS_LIMIT = 40

    def __init__(self):
        self._client: httpx.AsyncClient | None = None
        self._google_api_key = getattr(settings, 'google_books_api_key', None)

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(self.DEFAULT_TIMEOUT),
                follow_redirects=True,
                headers={
                    "User-Agent": "LiteratureAggregator/1.0",
                    "Accept": "application/json",
                }
            )
        return self._client

    async def close(self):
        """Close HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    # ============ Google Books API ============

    async def search_google_books(
        self,
        query: str,
        max_results: int = 10,
        start_index: int = 0,
        language: str | None = None,
        print_type: str | None = None,
        order_by: str | None = None,
    ) -> ExternalSearchResponse:
        """
        Search books using Google Books API.

        Args:
            query: Search query (supports special keywords like intitle:, inauthor:, isbn:)
            max_results: Maximum number of results (1-40)
            start_index: Starting index for pagination
            language: Filter by language (ISO-639-1 code)
            print_type: Filter by print type (all, books, magazines)
            order_by: Order results (relevance, newest)

        Returns:
            ExternalSearchResponse with search results

        Raises:
            ExternalAPIError: If API request fails
        """
        start_time = datetime.now()

        # Validate and cap max_results
        max_results = min(max(1, max_results), self.MAX_RESULTS_LIMIT)

        # Build query parameters
        params: dict[str, Any] = {
            "q": query,
            "maxResults": max_results,
            "startIndex": start_index,
        }

        if self._google_api_key:
            params["key"] = self._google_api_key

        if language:
            params["langRestrict"] = language

        if print_type:
            params["printType"] = print_type

        if order_by:
            params["orderBy"] = order_by

        try:
            client = await self._get_client()
            response = await client.get(
                f"{self.GOOGLE_BOOKS_BASE_URL}/volumes",
                params=params,
            )

            if response.status_code == 429:
                raise ExternalAPIError(
                    ExternalSource.GOOGLE_BOOKS,
                    "Rate limit exceeded. Please try again later.",
                    429
                )

            if response.status_code != 200:
                raise ExternalAPIError(
                    ExternalSource.GOOGLE_BOOKS,
                    f"API returned status {response.status_code}",
                    response.status_code
                )

            data = response.json()

        except httpx.TimeoutException:
            raise ExternalAPIError(
                ExternalSource.GOOGLE_BOOKS,
                "Request timed out"
            )
        except httpx.RequestError as e:
            raise ExternalAPIError(
                ExternalSource.GOOGLE_BOOKS,
                f"Request failed: {str(e)}"
            )

        # Parse results
        total_items = data.get("totalItems", 0)
        items = []

        for item in data.get("items", []):
            parsed = self._parse_google_book(item)
            if parsed:
                items.append(parsed)

        elapsed_ms = int((datetime.now() - start_time).total_seconds() * 1000)

        return ExternalSearchResponse(
            source=ExternalSource.GOOGLE_BOOKS,
            query=query,
            total_items=total_items,
            items=items,
            search_time_ms=elapsed_ms,
        )

    async def get_google_book_details(self, google_books_id: str) -> ExternalBookResult:
        """
        Get detailed information about a specific book from Google Books.

        Args:
            google_books_id: Google Books volume ID

        Returns:
            ExternalBookResult with full book details

        Raises:
            ExternalAPIError: If book not found or API request fails
        """
        params = {}
        if self._google_api_key:
            params["key"] = self._google_api_key

        try:
            client = await self._get_client()
            response = await client.get(
                f"{self.GOOGLE_BOOKS_BASE_URL}/volumes/{google_books_id}",
                params=params,
            )

            if response.status_code == 404:
                raise ExternalAPIError(
                    ExternalSource.GOOGLE_BOOKS,
                    f"Book with ID '{google_books_id}' not found",
                    404
                )

            if response.status_code != 200:
                raise ExternalAPIError(
                    ExternalSource.GOOGLE_BOOKS,
                    f"API returned status {response.status_code}",
                    response.status_code
                )

            data = response.json()

        except httpx.TimeoutException:
            raise ExternalAPIError(
                ExternalSource.GOOGLE_BOOKS,
                "Request timed out"
            )
        except httpx.RequestError as e:
            raise ExternalAPIError(
                ExternalSource.GOOGLE_BOOKS,
                f"Request failed: {str(e)}"
            )

        parsed = self._parse_google_book(data)
        if not parsed:
            raise ExternalAPIError(
                ExternalSource.GOOGLE_BOOKS,
                "Failed to parse book data"
            )

        return parsed

    def _parse_google_book(self, item: dict[str, Any]) -> ExternalBookResult | None:
        """Parse Google Books API item into ExternalBookResult."""
        try:
            volume_info = item.get("volumeInfo", {})

            # Extract ISBNs
            isbn_10 = None
            isbn_13 = None
            for identifier in volume_info.get("industryIdentifiers", []):
                id_type = identifier.get("type", "")
                if id_type == "ISBN_10":
                    isbn_10 = identifier.get("identifier")
                elif id_type == "ISBN_13":
                    isbn_13 = identifier.get("identifier")

            # Get best available thumbnail
            image_links = volume_info.get("imageLinks", {})
            thumbnail_url = (
                image_links.get("thumbnail") or
                image_links.get("smallThumbnail") or
                image_links.get("medium") or
                image_links.get("large")
            )

            # Convert HTTP to HTTPS for thumbnails
            if thumbnail_url and thumbnail_url.startswith("http://"):
                thumbnail_url = thumbnail_url.replace("http://", "https://")

            return ExternalBookResult(
                external_id=item.get("id", ""),
                source=ExternalSource.GOOGLE_BOOKS,
                title=volume_info.get("title", "Unknown Title"),
                authors=volume_info.get("authors", []),
                description=volume_info.get("description"),
                isbn_10=isbn_10,
                isbn_13=isbn_13,
                publisher=volume_info.get("publisher"),
                published_date=volume_info.get("publishedDate"),
                page_count=volume_info.get("pageCount"),
                categories=volume_info.get("categories", []),
                language=volume_info.get("language"),
                thumbnail_url=thumbnail_url,
                preview_link=volume_info.get("previewLink"),
                info_link=volume_info.get("infoLink"),
                average_rating=volume_info.get("averageRating"),
                ratings_count=volume_info.get("ratingsCount"),
                maturity_rating=volume_info.get("maturityRating"),
                raw_metadata={
                    "etag": item.get("etag"),
                    "selfLink": item.get("selfLink"),
                    "volumeInfo": volume_info,
                    "saleInfo": item.get("saleInfo", {}),
                    "accessInfo": item.get("accessInfo", {}),
                    "searchInfo": item.get("searchInfo", {}),
                }
            )
        except Exception:
            return None

    # ============ Open Library API ============

    async def search_open_library(
        self,
        query: str,
        max_results: int = 10,
        page: int = 1,
    ) -> ExternalSearchResponse:
        """
        Search books using Open Library API.

        Args:
            query: Search query
            max_results: Maximum number of results
            page: Page number for pagination

        Returns:
            ExternalSearchResponse with search results
        """
        start_time = datetime.now()

        params = {
            "q": query,
            "limit": min(max_results, 100),
            "page": page,
        }

        try:
            client = await self._get_client()
            response = await client.get(
                f"{self.OPEN_LIBRARY_BASE_URL}/search.json",
                params=params,
            )

            if response.status_code != 200:
                raise ExternalAPIError(
                    ExternalSource.OPEN_LIBRARY,
                    f"API returned status {response.status_code}",
                    response.status_code
                )

            data = response.json()

        except httpx.TimeoutException:
            raise ExternalAPIError(
                ExternalSource.OPEN_LIBRARY,
                "Request timed out"
            )
        except httpx.RequestError as e:
            raise ExternalAPIError(
                ExternalSource.OPEN_LIBRARY,
                f"Request failed: {str(e)}"
            )

        # Parse results
        total_items = data.get("numFound", 0)
        items = []

        for doc in data.get("docs", []):
            parsed = self._parse_open_library_book(doc)
            if parsed:
                items.append(parsed)

        elapsed_ms = int((datetime.now() - start_time).total_seconds() * 1000)

        return ExternalSearchResponse(
            source=ExternalSource.OPEN_LIBRARY,
            query=query,
            total_items=total_items,
            items=items,
            search_time_ms=elapsed_ms,
        )

    async def get_open_library_book_details(self, work_key: str) -> ExternalBookResult:
        """
        Get detailed information about a book from Open Library.

        Args:
            work_key: Open Library work key (e.g., "OL45883W")

        Returns:
            ExternalBookResult with book details
        """
        try:
            client = await self._get_client()

            # Get work details
            response = await client.get(
                f"{self.OPEN_LIBRARY_BASE_URL}/works/{work_key}.json"
            )

            if response.status_code == 404:
                raise ExternalAPIError(
                    ExternalSource.OPEN_LIBRARY,
                    f"Book with key '{work_key}' not found",
                    404
                )

            if response.status_code != 200:
                raise ExternalAPIError(
                    ExternalSource.OPEN_LIBRARY,
                    f"API returned status {response.status_code}",
                    response.status_code
                )

            work_data = response.json()

            # Get author details if available
            authors = []
            for author_ref in work_data.get("authors", []):
                author_key = author_ref.get("author", {}).get("key", "")
                if author_key:
                    try:
                        author_response = await client.get(
                            f"{self.OPEN_LIBRARY_BASE_URL}{author_key}.json"
                        )
                        if author_response.status_code == 200:
                            author_data = author_response.json()
                            authors.append(author_data.get("name", "Unknown"))
                    except Exception:
                        pass

            # Build cover URL
            cover_id = None
            if work_data.get("covers"):
                cover_id = work_data["covers"][0]

            thumbnail_url = None
            if cover_id:
                thumbnail_url = f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg"

            # Extract description
            description = work_data.get("description")
            if isinstance(description, dict):
                description = description.get("value", "")

            return ExternalBookResult(
                external_id=work_key,
                source=ExternalSource.OPEN_LIBRARY,
                title=work_data.get("title", "Unknown Title"),
                authors=authors,
                description=description,
                categories=work_data.get("subjects", [])[:5],
                thumbnail_url=thumbnail_url,
                info_link=f"https://openlibrary.org/works/{work_key}",
                raw_metadata=work_data,
            )

        except httpx.TimeoutException:
            raise ExternalAPIError(
                ExternalSource.OPEN_LIBRARY,
                "Request timed out"
            )
        except httpx.RequestError as e:
            raise ExternalAPIError(
                ExternalSource.OPEN_LIBRARY,
                f"Request failed: {str(e)}"
            )

    def _parse_open_library_book(self, doc: dict[str, Any]) -> ExternalBookResult | None:
        """Parse Open Library search result into ExternalBookResult."""
        try:
            # Get work key
            work_key = doc.get("key", "").replace("/works/", "")
            if not work_key:
                return None

            # Build cover URL
            cover_id = doc.get("cover_i")
            thumbnail_url = None
            if cover_id:
                thumbnail_url = f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg"

            # Extract ISBNs
            isbn_list = doc.get("isbn", [])
            isbn_10 = None
            isbn_13 = None
            for isbn in isbn_list:
                if len(isbn) == 10 and not isbn_10:
                    isbn_10 = isbn
                elif len(isbn) == 13 and not isbn_13:
                    isbn_13 = isbn

            return ExternalBookResult(
                external_id=work_key,
                source=ExternalSource.OPEN_LIBRARY,
                title=doc.get("title", "Unknown Title"),
                authors=doc.get("author_name", []),
                isbn_10=isbn_10,
                isbn_13=isbn_13,
                publisher=doc.get("publisher", [None])[0] if doc.get("publisher") else None,
                published_date=str(doc.get("first_publish_year", "")) if doc.get("first_publish_year") else None,
                page_count=doc.get("number_of_pages_median"),
                categories=doc.get("subject", [])[:5],
                language=doc.get("language", [None])[0] if doc.get("language") else None,
                thumbnail_url=thumbnail_url,
                info_link=f"https://openlibrary.org/works/{work_key}",
                raw_metadata=doc,
            )
        except Exception:
            return None

    # ============ Unified Search ============

    async def search_all_sources(
        self,
        query: str,
        max_results_per_source: int = 10,
        sources: list[ExternalSource] | None = None,
    ) -> dict[ExternalSource, ExternalSearchResponse]:
        """
        Search books across multiple external sources.

        Args:
            query: Search query
            max_results_per_source: Maximum results per source
            sources: List of sources to search (defaults to all)

        Returns:
            Dictionary mapping source to search response
        """
        if sources is None:
            sources = [ExternalSource.GOOGLE_BOOKS, ExternalSource.OPEN_LIBRARY]

        results = {}
        tasks = []

        for source in sources:
            if source == ExternalSource.GOOGLE_BOOKS:
                tasks.append((source, self.search_google_books(query, max_results_per_source)))
            elif source == ExternalSource.OPEN_LIBRARY:
                tasks.append((source, self.search_open_library(query, max_results_per_source)))

        # Execute searches concurrently
        for source, task in tasks:
            try:
                results[source] = await task
            except ExternalAPIError as e:
                # Create empty response with error indication
                results[source] = ExternalSearchResponse(
                    source=source,
                    query=query,
                    total_items=0,
                    items=[],
                    search_time_ms=0,
                )

        return results

    def get_available_sources(self) -> list[dict[str, Any]]:
        """Get list of available external sources with their capabilities."""
        return [
            {
                "id": ExternalSource.GOOGLE_BOOKS.value,
                "name": "Google Books",
                "description": "Search millions of books from Google's index",
                "features": ["search", "details", "preview", "thumbnails"],
                "rate_limit": "1000 requests/day (without API key)",
                "has_api_key": bool(self._google_api_key),
            },
            {
                "id": ExternalSource.OPEN_LIBRARY.value,
                "name": "Open Library",
                "description": "Free, editable library catalog from Internet Archive",
                "features": ["search", "details", "thumbnails", "full_text"],
                "rate_limit": "No strict limit",
                "has_api_key": True,  # No key required
            },
        ]


# Singleton instance
_external_apis_service: ExternalApisService | None = None


def get_external_apis_service() -> ExternalApisService:
    """Get singleton instance of ExternalApisService."""
    global _external_apis_service
    if _external_apis_service is None:
        _external_apis_service = ExternalApisService()
    return _external_apis_service


async def cleanup_external_apis_service():
    """Cleanup external APIs service on shutdown."""
    global _external_apis_service
    if _external_apis_service:
        await _external_apis_service.close()
        _external_apis_service = None
