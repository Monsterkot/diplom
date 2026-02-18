"""
Pydantic schemas for request/response validation.
"""
from app.schemas.user import (
    UserCreate,
    UserResponse,
    UserInDB,
    Token,
    TokenPayload,
)
from app.schemas.book import (
    BookCreate,
    BookUpdate,
    BookResponse,
    BookListResponse,
    BookSearchParams,
    BookFileResponse,
)
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
    GoogleBooksMetadata,
    TaskStatusResponse,
    MetadataUpdateRequest,
    MetadataUpdateResponse,
)
from app.schemas.common import (
    PaginationParams,
    MessageResponse,
)

__all__ = [
    # User
    "UserCreate",
    "UserResponse",
    "UserInDB",
    "Token",
    "TokenPayload",
    # Book
    "BookCreate",
    "BookUpdate",
    "BookResponse",
    "BookListResponse",
    "BookSearchParams",
    "BookFileResponse",
    # External Book
    "ExternalSourceEnum",
    "ExternalBookSearchResult",
    "ExternalSearchResponse",
    "MultiSourceSearchResponse",
    "ExternalBookImportRequest",
    "BulkImportRequest",
    "ImportResult",
    "BulkImportResponse",
    "ExternalBookResponse",
    "ExternalBookListResponse",
    "ExternalSourceInfo",
    "SourcesListResponse",
    "GoogleBooksMetadata",
    "TaskStatusResponse",
    "MetadataUpdateRequest",
    "MetadataUpdateResponse",
    # Common
    "PaginationParams",
    "MessageResponse",
]
