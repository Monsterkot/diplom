"""
API routers and endpoints.
"""
from fastapi import APIRouter

from app.api.endpoints import auth, books, health, search, users, external

# Main API router
api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(books.router, prefix="/books", tags=["Books"])
api_router.include_router(search.router, prefix="/search", tags=["Search"])
api_router.include_router(external.router, tags=["External"])
