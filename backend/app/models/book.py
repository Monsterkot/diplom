"""
Book model for user-uploaded books.
"""
from sqlalchemy import String, Text, BigInteger, DateTime, ForeignKey, func, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from typing import TYPE_CHECKING

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class Book(Base):
    """Book model for user-uploaded literature."""

    __tablename__ = "books"

    # Primary key
    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # Book metadata
    title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        index=True,
    )
    author: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    isbn: Mapped[str | None] = mapped_column(
        String(20),
        unique=True,
        nullable=True,
        index=True,
    )
    publisher: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    published_year: Mapped[int | None] = mapped_column(
        nullable=True,
    )
    language: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    category: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    # File information
    file_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    file_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    file_size: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )
    content_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    cover_path: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    # User relationship
    uploaded_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
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

    # Relationships
    uploaded_by: Mapped["User"] = relationship(
        "User",
        back_populates="books",
    )

    # Indexes for search
    __table_args__ = (
        Index("ix_books_title_author", "title", "author"),
        Index("ix_books_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Book(id={self.id}, title={self.title})>"
