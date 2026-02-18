"""
CRUD operations for database models.
"""
from app.crud.book import book_crud
from app.crud.user import user_crud

__all__ = ["book_crud", "user_crud"]
