"""
ExternalBook model for books fetched from external APIs.
"""
from sqlalchemy import String, Text, DateTime, func, Index, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from datetime import datetime
from typing import Any, TYPE_CHECKING

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.book import Book


class ExternalBook(Base):
    """
    Model for books fetched from external APIs.

    Sources:
    - google_books: Google Books API
    - open_library: Open Library API
    """

    __tablename__ = "external_books"

    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # Source information
    source: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    external_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    # Book metadata (cached from external API)
    title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        index=True,
    )
    authors: Mapped[list[str] | None] = mapped_column(
        ARRAY(String(255)),
        nullable=True,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    cover_url: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )
    published_date: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    published_year: Mapped[int | None] = mapped_column(
        nullable=True,
    )
    language: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    categories: Mapped[list[str] | None] = mapped_column(
        ARRAY(String(100)),
        nullable=True,
    )

    # ISBN identifiers
    isbn_10: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        index=True,
    )
    isbn_13: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        index=True,
    )

    # Additional metadata
    publisher: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    page_count: Mapped[int | None] = mapped_column(
        nullable=True,
    )
    average_rating: Mapped[float | None] = mapped_column(
        nullable=True,
    )
    ratings_count: Mapped[int | None] = mapped_column(
        nullable=True,
    )

    # Full metadata from API (JSONB for PostgreSQL)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    # External links
    preview_link: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )
    info_link: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )
    download_url: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    # Import tracking
    is_imported: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    imported_book_id: Mapped[int | None] = mapped_column(
        ForeignKey("books.id", ondelete="SET NULL"),
        nullable=True,
    )
    imported_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    imported_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        onupdate=func.now(),
        nullable=True,
    )
    last_fetched_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    imported_book: Mapped["Book | None"] = relationship(
        "Book",
        foreign_keys=[imported_book_id],
    )
    imported_by: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[imported_by_id],
    )

    # Indexes (note: title already has index=True on column definition)
    __table_args__ = (
        Index("ix_external_books_source_external_id", "source", "external_id", unique=True),
        Index("ix_external_books_isbn", "isbn_10", "isbn_13"),
    )

    @property
    def author(self) -> str | None:
        """Get first author as string for compatibility."""
        if self.authors:
            return self.authors[0]
        return None

    @property
    def authors_str(self) -> str:
        """Get authors as comma-separated string."""
        if self.authors:
            return ", ".join(self.authors)
        return ""

    def __repr__(self) -> str:
        return f"<ExternalBook(id={self.id}, source={self.source}, title={self.title})>"
