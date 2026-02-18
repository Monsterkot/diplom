"""
Health check endpoints.
"""
from fastapi import APIRouter

from app.core.config import settings

router = APIRouter()


@router.get("/health")
async def health_check():
    """
    Health check endpoint.

    Returns service status and basic information.
    """
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.app_version,
    }


@router.get("/")
async def root():
    """
    Root endpoint.

    Returns welcome message and API documentation links.
    """
    return {
        "message": f"Welcome to {settings.app_name} API",
        "version": settings.app_version,
        "docs": "/docs",
        "redoc": "/redoc",
    }
