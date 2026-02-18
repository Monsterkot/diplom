"""
Literature Aggregation System - FastAPI Application

Main entry point for the backend API.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
import sys

from app.core.config import settings
from app.core.database import init_db, close_db
from app.core.meilisearch import get_meili_client
from app.api import api_router

# Configure loguru
logger.remove()
logger.add(
    sys.stderr,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level="DEBUG" if settings.debug else "INFO",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.

    Handles startup and shutdown events.
    """
    # Startup
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    logger.info(f"Debug mode: {settings.debug}")
    logger.info(f"Database: {settings.database_url.split('@')[-1]}")
    logger.info(f"MinIO: {settings.minio_endpoint}")
    logger.info(f"Meilisearch: {settings.meili_url}")

    # Initialize database tables
    if settings.debug:
        logger.info("Initializing database tables...")
        await init_db()
        logger.info("Database tables initialized")

    # Initialize Meilisearch indexes
    try:
        logger.info("Initializing Meilisearch indexes...")
        meili_client = get_meili_client()
        await meili_client.initialize_indexes()
        logger.info("Meilisearch indexes initialized")
    except Exception as e:
        logger.warning(f"Failed to initialize Meilisearch: {e}")
        logger.warning("Search functionality may not work properly")

    yield

    # Shutdown
    logger.info("Shutting down...")
    await close_db()
    logger.info("Database connections closed")


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    description="""
## Literature Aggregation System API

API для агрегации и анализа учебной литературы.

### Features:
- 📚 Upload and manage books (PDF, EPUB, TXT)
- 🔍 Full-text search across library
- 👤 User authentication with JWT
- 📥 Download books with presigned URLs
- 🏷️ Categorize and filter books

### Authentication:
Most endpoints require JWT authentication. Use `/api/auth/login` to get a token.
""",
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix="/api")


# Health check at root (outside /api prefix)
@app.get("/health", tags=["Health"])
async def root_health():
    """Root health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.app_version,
    }


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with API information."""
    return {
        "message": f"Welcome to {settings.app_name}",
        "version": settings.app_version,
        "docs": "/docs",
        "redoc": "/redoc",
        "health": "/health",
    }
