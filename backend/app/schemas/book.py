"""
Book schemas for CRUD operations.
"""
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import List

from app.schemas.common import CamelCaseModel


class BookBase(BaseModel):
    """Base book schema with common fields."""

    title: str = Field(min_length=1, max_length=500)
    author: str | None = Field(default=None, max_length=255)
    description: str | None = None
    isbn: str | None = Field(default=None, max_length=20)
    publisher: str | None = Field(default=None, max_length=255)
    published_year: int | None = Field(default=None, ge=1000, le=2100)
    language: str | None = Field(default=None, max_length=50)
    category: str | None = Field(default=None, max_length=100)


class BookCreate(BookBase):
    """
    Schema for creating a new book.
    File is uploaded separately via multipart/form-data.
    """

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        return v.strip()

    @field_validator("author")
    @classmethod
    def validate_author(cls, v: str | None) -> str | None:
        if v:
            return v.strip()
        return v


class BookUpdate(BaseModel):
    """Schema for updating book metadata."""

    title: str | None = Field(default=None, min_length=1, max_length=500)
    author: str | None = Field(default=None, max_length=255)
    description: str | None = None
    isbn: str | None = Field(default=None, max_length=20)
    publisher: str | None = Field(default=None, max_length=255)
    published_year: int | None = Field(default=None, ge=1000, le=2100)
    language: str | None = Field(default=None, max_length=50)
    category: str | None = Field(default=None, max_length=100)


class BookResponse(CamelCaseModel):
    """Schema for book response with camelCase serialization."""

    id: int
    title: str
    author: str | None = None
    description: str | None = None
    isbn: str | None = None
    publisher: str | None = None
    published_year: int | None = None
    language: str | None = None
    category: str | None = None
    file_path: str
    file_name: str
    file_size: int
    content_type: str
    cover_path: str | None = None
    cover_url: str | None = None
    download_url: str | None = None
    uploaded_by_id: int
    created_at: datetime
    updated_at: datetime | None = None


class BookListResponse(CamelCaseModel):
    """Paginated list of books response with camelCase serialization."""

    items: List[BookResponse]
    total: int
    skip: int
    limit: int
    has_more: bool


class BookSearchParams(BaseModel):
    """Search parameters for books."""

    q: str = Field(min_length=1, description="Search query")
    category: str | None = None
    author: str | None = None
    language: str | None = None
    year_from: int | None = Field(default=None, ge=1000)
    year_to: int | None = Field(default=None, le=2100)


class BookFileInfo(BaseModel):
    """File information for uploaded book."""

    file_path: str
    file_name: str
    file_size: int
    content_type: str


class BookFileResponse(CamelCaseModel):
    """Response for book file endpoint with camelCase serialization."""

    url: str
    file_name: str
    file_size: int
    content_type: str
