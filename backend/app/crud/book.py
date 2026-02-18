"""
CRUD operations for Book model.
"""
from typing import Sequence
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud.base import CRUDBase
from app.models.book import Book
from app.schemas.book import BookCreate, BookUpdate


class CRUDBook(CRUDBase[Book, BookCreate, BookUpdate]):
    """CRUD operations for Book model."""

    async def get_with_user(self, db: AsyncSession, id: int) -> Book | None:
        """Get book by ID with user relationship loaded."""
        result = await db.execute(
            select(Book)
            .options(selectinload(Book.uploaded_by))
            .where(Book.id == id)
        )
        return result.scalar_one_or_none()

    async def get_multi_by_user(
        self,
        db: AsyncSession,
        *,
        user_id: int,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[Book]:
        """Get books uploaded by a specific user."""
        result = await db.execute(
            select(Book)
            .where(Book.uploaded_by_id == user_id)
            .offset(skip)
            .limit(limit)
            .order_by(Book.created_at.desc())
        )
        return result.scalars().all()

    async def count_by_user(self, db: AsyncSession, user_id: int) -> int:
        """Count books uploaded by a specific user."""
        result = await db.execute(
            select(func.count())
            .select_from(Book)
            .where(Book.uploaded_by_id == user_id)
        )
        return result.scalar_one()

    async def search(
        self,
        db: AsyncSession,
        *,
        query: str,
        category: str | None = None,
        author: str | None = None,
        language: str | None = None,
        year_from: int | None = None,
        year_to: int | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[Sequence[Book], int]:
        """
        Search books by title, author, or description.
        Returns tuple of (books, total_count).
        """
        # Base query with search
        search_pattern = f"%{query}%"
        conditions = [
            or_(
                Book.title.ilike(search_pattern),
                Book.author.ilike(search_pattern),
                Book.description.ilike(search_pattern),
            )
        ]

        # Apply filters
        if category:
            conditions.append(Book.category == category)
        if author:
            conditions.append(Book.author.ilike(f"%{author}%"))
        if language:
            conditions.append(Book.language == language)
        if year_from:
            conditions.append(Book.published_year >= year_from)
        if year_to:
            conditions.append(Book.published_year <= year_to)

        # Count total matching records
        count_query = select(func.count()).select_from(Book).where(*conditions)
        count_result = await db.execute(count_query)
        total = count_result.scalar_one()

        # Get paginated results
        result = await db.execute(
            select(Book)
            .where(*conditions)
            .offset(skip)
            .limit(limit)
            .order_by(Book.created_at.desc())
        )
        books = result.scalars().all()

        return books, total

    async def get_by_isbn(self, db: AsyncSession, isbn: str) -> Book | None:
        """Get book by ISBN."""
        result = await db.execute(
            select(Book).where(Book.isbn == isbn)
        )
        return result.scalar_one_or_none()

    async def create_with_file(
        self,
        db: AsyncSession,
        *,
        obj_in: BookCreate,
        file_path: str,
        file_name: str,
        file_size: int,
        content_type: str,
        uploaded_by_id: int,
    ) -> Book:
        """Create a new book with file information."""
        book_data = obj_in.model_dump()
        book_data.update({
            "file_path": file_path,
            "file_name": file_name,
            "file_size": file_size,
            "content_type": content_type,
            "uploaded_by_id": uploaded_by_id,
        })

        db_obj = Book(**book_data)
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def get_categories(self, db: AsyncSession) -> Sequence[str]:
        """Get list of unique categories."""
        result = await db.execute(
            select(Book.category)
            .where(Book.category.isnot(None))
            .distinct()
            .order_by(Book.category)
        )
        return result.scalars().all()

    async def get_languages(self, db: AsyncSession) -> Sequence[str]:
        """Get list of unique languages."""
        result = await db.execute(
            select(Book.language)
            .where(Book.language.isnot(None))
            .distinct()
            .order_by(Book.language)
        )
        return result.scalars().all()


# Singleton instance
book_crud = CRUDBook(Book)
