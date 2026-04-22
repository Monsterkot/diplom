"""
Authorization-related constants and helpers.
"""
from enum import Enum


class UserRole(str, Enum):
    """Application user roles."""

    USER = "user"
    MODERATOR = "moderator"
    ADMIN = "admin"


class BookStatus(str, Enum):
    """Visibility status for books."""

    PUBLISHED = "published"
    HIDDEN = "hidden"


class BookVisibility(str, Enum):
    """User-controlled visibility for books."""

    PRIVATE = "private"
    PUBLIC = "public"


def is_admin_role(role: str | UserRole | None) -> bool:
    """Check whether a role grants admin access."""

    role_value = role.value if isinstance(role, UserRole) else role
    return role_value == UserRole.ADMIN.value


def is_moderator_role(role: str | UserRole | None) -> bool:
    """Check whether a role grants moderator access."""

    role_value = role.value if isinstance(role, UserRole) else role
    return role_value == UserRole.MODERATOR.value


def can_manage_books_role(role: str | UserRole | None) -> bool:
    """Check whether a role can moderate books."""

    role_value = role.value if isinstance(role, UserRole) else role
    return role_value in {UserRole.MODERATOR.value, UserRole.ADMIN.value}
