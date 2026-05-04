"""
External APIs service for book aggregation from external sources.
Currently supports Google Books only.
"""
import httpx
from typing import Any
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field

from app.core.config import settings


class ExternalSource(str, Enum):
    """Supported external book sources."""
    GOOGLE_BOOKS = "google_books"


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
    web_reader_link: str | None = None
    buy_link: str | None = None
    download_url: str | None = None
    can_download: bool = False
    download_formats: list[str] = Field(default_factory=list)
    viewability: str | None = None
    access_view_status: str | None = None
    public_domain: bool = False
    embeddable: bool = False
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
            access_info = item.get("accessInfo", {})
            sale_info = item.get("saleInfo", {})

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

            download_formats = []
            download_url = None
            for file_format in ("pdf", "epub"):
                format_info = access_info.get(file_format, {})
                link = format_info.get("downloadLink")
                if format_info.get("isAvailable") and link:
                    download_formats.append(file_format.upper())
                    download_url = download_url or link

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
                web_reader_link=access_info.get("webReaderLink"),
                buy_link=sale_info.get("buyLink"),
                download_url=download_url,
                can_download=bool(download_formats),
                download_formats=download_formats,
                viewability=access_info.get("viewability"),
                access_view_status=access_info.get("accessViewStatus"),
                public_domain=bool(access_info.get("publicDomain", False)),
                embeddable=bool(access_info.get("embeddable", False)),
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

    # ============ Unified Search ============

    async def search_all_sources(
        self,
        query: str,
        max_results_per_source: int = 10,
        sources: list[ExternalSource] | None = None,
        start_index: int = 0,
    ) -> dict[ExternalSource, ExternalSearchResponse]:
        """
        Search books across configured external sources.

        Args:
            query: Search query
            max_results_per_source: Maximum results per source
            sources: List of sources to search (defaults to Google Books)
            start_index: Starting index for pagination

        Returns:
            Dictionary mapping source to search response
        """
        if sources is None:
            sources = [ExternalSource.GOOGLE_BOOKS]

        results = {}
        tasks = []

        for source in sources:
            if source == ExternalSource.GOOGLE_BOOKS:
                tasks.append((source, self.search_google_books(query, max_results_per_source, start_index)))

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
