"""
Schemas for external book search and import operations.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Any
from enum import Enum

from app.schemas.common import CamelCaseModel


class ExternalSourceEnum(str, Enum):
    """External book sources."""
    GOOGLE_BOOKS = "google_books"
    OPEN_LIBRARY = "open_library"


# ============ Search Schemas ============

class ExternalBookSearchResult(CamelCaseModel):
    """Result item from external book search with camelCase serialization."""
    external_id: str
    source: ExternalSourceEnum
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

    # Import status (populated when checking against local DB)
    is_imported: bool = False
    imported_book_id: int | None = None


class ExternalSearchResponse(CamelCaseModel):
    """Response for external book search with camelCase serialization."""
    source: ExternalSourceEnum
    query: str
    total_items: int
    items: list[ExternalBookSearchResult]
    search_time_ms: int


class MultiSourceSearchResponse(CamelCaseModel):
    """Response for multi-source search with camelCase serialization."""
    query: str
    results: dict[str, ExternalSearchResponse]
    total_items: int
    total_search_time_ms: int


# ============ Import Schemas ============

class ExternalBookImportRequest(BaseModel):
    """Request to import an external book."""
    source: ExternalSourceEnum
    external_id: str

    # Optional: override metadata during import
    title: str | None = None
    author: str | None = None
    description: str | None = None
    category: str | None = None
    language: str | None = None


class BulkImportRequest(BaseModel):
    """Request for bulk import of external books."""
    items: list[ExternalBookImportRequest] = Field(min_length=1, max_length=100)


class ImportResult(CamelCaseModel):
    """Result of a single import operation with camelCase serialization."""
    external_id: str
    source: ExternalSourceEnum
    success: bool
    message: str
    external_book_id: int | None = None
    error: str | None = None


class BulkImportResponse(CamelCaseModel):
    """Response for bulk import operation with camelCase serialization."""
    total: int
    successful: int
    failed: int
    results: list[ImportResult]
    task_id: str | None = None  # For async bulk imports


# ============ External Book Response Schemas ============

class ExternalBookResponse(CamelCaseModel):
    """Response schema for external book from database with camelCase serialization."""
    id: int
    source: str
    external_id: str
    title: str
    authors: list[str] | None = None
    description: str | None = None
    cover_url: str | None = None
    published_date: str | None = None
    published_year: int | None = None
    language: str | None = None
    categories: list[str] | None = None
    isbn_10: str | None = None
    isbn_13: str | None = None
    publisher: str | None = None
    page_count: int | None = None
    average_rating: float | None = None
    ratings_count: int | None = None
    preview_link: str | None = None
    info_link: str | None = None
    download_url: str | None = None
    is_imported: bool = False
    imported_book_id: int | None = None
    imported_at: datetime | None = None
    created_at: datetime
    updated_at: datetime | None = None

    @property
    def author(self) -> str | None:
        """Get first author for compatibility."""
        if self.authors:
            return self.authors[0]
        return None

    @property
    def authors_str(self) -> str:
        """Get authors as comma-separated string."""
        if self.authors:
            return ", ".join(self.authors)
        return ""


class ExternalBookListResponse(CamelCaseModel):
    """Paginated list of external books with camelCase serialization."""
    items: list[ExternalBookResponse]
    total: int
    skip: int
    limit: int
    has_more: bool


# ============ Source Info Schemas ============

class ExternalSourceInfo(CamelCaseModel):
    """Information about an external source with camelCase serialization."""
    id: str
    name: str
    description: str
    features: list[str]
    rate_limit: str
    has_api_key: bool
    is_available: bool = True


class SourcesListResponse(CamelCaseModel):
    """List of available external sources with camelCase serialization."""
    sources: list[ExternalSourceInfo]


# ============ Google Books Specific Schemas ============

class GoogleBooksMetadata(BaseModel):
    """Google Books specific metadata."""
    google_books_id: str
    etag: str | None = None
    self_link: str | None = None
    volume_info: dict[str, Any] = Field(default_factory=dict)
    sale_info: dict[str, Any] = Field(default_factory=dict)
    access_info: dict[str, Any] = Field(default_factory=dict)
    search_info: dict[str, Any] = Field(default_factory=dict)


# ============ Task Schemas ============

class TaskStatusResponse(CamelCaseModel):
    """Response for async task status with camelCase serialization."""
    task_id: str
    status: str  # pending, started, success, failure
    progress: int | None = None
    result: Any | None = None
    error: str | None = None
    created_at: datetime | None = None
    completed_at: datetime | None = None


class MetadataUpdateRequest(BaseModel):
    """Request to update metadata for external books."""
    source: ExternalSourceEnum | None = None
    external_ids: list[str] | None = None
    force_update: bool = False


class MetadataUpdateResponse(CamelCaseModel):
    """Response for metadata update operation with camelCase serialization."""
    task_id: str
    message: str
    items_to_update: int
