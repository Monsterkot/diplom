"""
Common schemas used across the application.
"""
from pydantic import BaseModel, ConfigDict, Field
from typing import Generic, TypeVar, List


def to_camel(string: str) -> str:
    """Convert snake_case to camelCase."""
    components = string.split("_")
    return components[0] + "".join(x.title() for x in components[1:])


T = TypeVar("T")


class CamelCaseModel(BaseModel):
    """Base model with camelCase serialization for API responses."""

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        alias_generator=to_camel,
    )


class PaginationParams(BaseModel):
    """Pagination parameters for list endpoints."""

    skip: int = Field(default=0, ge=0, description="Number of records to skip")
    limit: int = Field(default=20, ge=1, le=100, description="Maximum number of records to return")


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response."""

    items: List[T]
    total: int
    skip: int
    limit: int
    has_more: bool


class MessageResponse(BaseModel):
    """Simple message response."""

    message: str
    success: bool = True


class ErrorResponse(BaseModel):
    """Error response schema."""

    detail: str
    error_code: str | None = None
