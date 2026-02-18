"""
SQLAlchemy models for the Literature Aggregation System.
"""
from app.models.user import User
from app.models.book import Book
from app.models.external_book import ExternalBook

__all__ = ["User", "Book", "ExternalBook"]
