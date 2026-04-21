"""
Schemas for admin APIs.
"""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.core.access import BookStatus, UserRole
from app.schemas.book import BookResponse
from app.schemas.common import CamelCaseModel
from app.schemas.user import UserResponse, UserSummary


class AdminUsersListResponse(CamelCaseModel):
    """Paginated admin users list."""

    items: list[UserResponse]
    total: int
    skip: int
    limit: int
    has_more: bool


class UpdateUserRoleRequest(BaseModel):
    """Request to update a user's role."""

    role: UserRole


class UpdateUserBlockRequest(BaseModel):
    """Request to block or unblock a user."""

    is_blocked: bool


class AdminBooksListResponse(CamelCaseModel):
    """Paginated admin books list."""

    items: list[BookResponse]
    total: int
    skip: int
    limit: int
    has_more: bool


class UpdateBookStatusRequest(BaseModel):
    """Request to update a book visibility status."""

    status: BookStatus


class AdminStatsResponse(CamelCaseModel):
    """Dashboard statistics for the admin area."""

    total_users: int
    active_users: int
    blocked_users: int
    admin_users: int
    moderator_users: int
    total_books: int
    published_books: int
    hidden_books: int
    uploaded_books: int
    imported_books: int
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class AuditLogResponse(CamelCaseModel):
    """Audit log entry for admin responses."""

    id: int
    action: str
    entity_type: str
    entity_id: int | None
    details: dict[str, Any] | None
    actor: UserSummary | None
    created_at: datetime


class AdminAuditLogsListResponse(CamelCaseModel):
    """Paginated audit log response."""

    items: list[AuditLogResponse]
    total: int
    skip: int
    limit: int
    has_more: bool
