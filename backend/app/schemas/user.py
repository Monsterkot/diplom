"""
User schemas for authentication and user management.
"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime
import re

from app.schemas.common import CamelCaseModel


class UserBase(BaseModel):
    """Base user schema with common fields."""

    email: EmailStr
    username: str = Field(min_length=3, max_length=50)

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9_-]+$", v):
            raise ValueError("Username can only contain letters, numbers, underscores and hyphens")
        return v.lower()


class UserCreate(UserBase):
    """Schema for creating a new user."""

    password: str = Field(min_length=8, max_length=100)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserResponse(CamelCaseModel):
    """Schema for user response (public data) with camelCase serialization."""

    id: int
    email: EmailStr
    username: str
    is_active: bool
    created_at: datetime


class UserInDB(UserResponse):
    """Schema for user stored in database (includes hashed password)."""

    hashed_password: str
    is_superuser: bool


class UserLogin(BaseModel):
    """Schema for user login."""

    email: EmailStr
    password: str


class Token(BaseModel):
    """JWT Token response schema (snake_case per OAuth2 standard)."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class TokenPayload(BaseModel):
    """JWT Token payload schema."""

    sub: int  # user_id
    exp: datetime
    iat: datetime
    type: str = "access"  # access or refresh
