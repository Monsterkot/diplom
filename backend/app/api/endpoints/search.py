"""
Search endpoints using Meilisearch for full-text search.
"""
from typing import Annotated, Any

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel, Field

from app.crud.book import book_crud
from app.schemas.book import BookListResponse, BookResponse
from app.services.auth import DBSession
from app.services.search_service import get_search_service, SearchResponse, SuggestResponse
from app.services.file_service import get_file_service

router = APIRouter()


# ============ Response Schemas ============

class SearchHitResponse(BaseModel):
    """Search result hit with highlights."""
    id: int
    title: str
    author: str | None = None
    description: str | None = None
    cover_url: str | None = None
    category: str | None = None
    language: str | None = None
    published_year: int | None = None
    content_type: str | None = None
    file_size: int | None = None
    source: str = "upload"
    created_at: str | None = None

    # Highlighted snippets
    title_highlighted: str | None = None
    author_highlighted: str | None = None
    description_highlighted: str | None = None
    content_snippet: str | None = None


class FullSearchResponse(BaseModel):
    """Full search response with results, facets, and pagination."""
    query: str
    hits: list[SearchHitResponse]
    total_hits: int
    processing_time_ms: int
    page: int
    hits_per_page: int
    total_pages: int

    # Facets for filter options
    facets: dict[str, dict[str, int]] = Field(default_factory=dict)


class SuggestItemResponse(BaseModel):
    """Autocomplete suggestion."""
    id: int
    title: str
    author: str | None = None
    category: str | None = None


class SuggestListResponse(BaseModel):
    """Autocomplete suggestions list."""
    query: str
    suggestions: list[SuggestItemResponse]
    processing_time_ms: int


class SearchStatsResponse(BaseModel):
    """Search index statistics."""
    number_of_documents: int
    is_indexing: bool
    field_distribution: dict[str, int] = Field(default_factory=dict)


# ============ Endpoints ============

@router.get("/", response_model=FullSearchResponse)
async def search_books(
    q: Annotated[str, Query(min_length=1, description="Search query")],
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    category: str | None = Query(None, description="Filter by category"),
    author: str | None = Query(None, description="Filter by author"),
    language: str | None = Query(None, description="Filter by language"),
    content_type: str | None = Query(None, description="Filter by file type"),
    year_from: Annotated[int | None, Query(ge=1000)] = None,
    year_to: Annotated[int | None, Query(le=2100)] = None,
    sort: str | None = Query(None, description="Sort field (e.g., 'published_year:desc')"),
):
    """
    Full-text search for books using Meilisearch.

    Features:
    - Full-text search across title, author, description, and content
    - Typo tolerance
    - Relevance-based ranking
    - Faceted filtering
    - Highlighted search terms in results

    Args:
        q: Search query string
        page: Page number (starting from 1)
        limit: Results per page
        category: Filter by category
        author: Filter by author
        language: Filter by language
        content_type: Filter by content type (pdf, epub, txt, docx)
        year_from: Filter by publication year (minimum)
        year_to: Filter by publication year (maximum)
        sort: Sort field and direction

    Returns:
        Search results with highlights and facets
    """
    search_service = get_search_service()

    # Build filters
    filters: dict[str, Any] = {}
    if category:
        filters["category"] = category
    if author:
        filters["author"] = author
    if language:
        filters["language"] = language
    if content_type:
        filters["content_type"] = content_type
    if year_from or year_to:
        filters["published_year"] = {}
        if year_from:
            filters["published_year"]["min"] = year_from
        if year_to:
            filters["published_year"]["max"] = year_to

    # Build sort
    sort_list = None
    if sort:
        sort_list = [sort]

    try:
        result = await search_service.search(
            query=q,
            page=page,
            hits_per_page=limit,
            filters=filters if filters else None,
            sort=sort_list,
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Search service error: {str(e)}")

    # Convert hits to response format
    hits = []
    for hit in result.hits:
        response_hit = SearchHitResponse(
            id=hit.id,
            title=hit.title,
            author=hit.author,
            description=hit.description,
            cover_url=hit.cover_url,
            category=hit.category,
            language=hit.language,
            published_year=hit.published_year,
            content_type=hit.content_type,
            file_size=hit.file_size,
            source=hit.source,
            created_at=hit.created_at,
            title_highlighted=hit.highlights.get("title"),
            author_highlighted=hit.highlights.get("author"),
            description_highlighted=hit.highlights.get("description"),
            content_snippet=hit.highlights.get("content"),
        )
        hits.append(response_hit)

    return FullSearchResponse(
        query=q,
        hits=hits,
        total_hits=result.total_hits,
        processing_time_ms=result.processing_time_ms,
        page=page,
        hits_per_page=limit,
        total_pages=result.total_pages,
        facets=result.facets,
    )


@router.get("/suggest", response_model=SuggestListResponse)
async def suggest_search(
    q: Annotated[str, Query(min_length=2, description="Search prefix")],
    limit: Annotated[int, Query(ge=1, le=10)] = 5,
):
    """
    Get autocomplete suggestions for search.

    Returns matching book titles for the search box autocomplete.

    Args:
        q: Partial search query (minimum 2 characters)
        limit: Maximum number of suggestions

    Returns:
        List of suggested books
    """
    search_service = get_search_service()

    try:
        result = await search_service.suggest(query=q, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Search service error: {str(e)}")

    return SuggestListResponse(
        query=q,
        suggestions=[
            SuggestItemResponse(
                id=s.id,
                title=s.title,
                author=s.author,
                category=s.category,
            )
            for s in result.suggestions
        ],
        processing_time_ms=result.processing_time_ms,
    )


@router.get("/similar/{book_id}")
async def get_similar_books(
    book_id: int,
    limit: Annotated[int, Query(ge=1, le=20)] = 5,
):
    """
    Get books similar to a given book.

    Uses the book's title, author, and category to find similar books.

    Args:
        book_id: ID of the reference book
        limit: Maximum number of similar books

    Returns:
        List of similar books
    """
    search_service = get_search_service()

    try:
        similar = await search_service.get_similar_books(book_id, limit)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Search service error: {str(e)}")

    return {
        "book_id": book_id,
        "similar": [
            {
                "id": book.id,
                "title": book.title,
                "author": book.author,
                "category": book.category,
                "cover_url": book.cover_url,
            }
            for book in similar
        ],
    }


@router.get("/facets")
async def get_search_facets(
    q: str = Query("", description="Optional search query to scope facets"),
):
    """
    Get available filter facets and their counts.

    Returns the distribution of categories, authors, languages, etc.
    for use in filter dropdowns.

    Args:
        q: Optional search query to scope the facet counts

    Returns:
        Facet distributions for filtering
    """
    search_service = get_search_service()

    try:
        # Perform a search with empty query to get all facets
        result = await search_service.search(
            query=q if q else "*",
            page=1,
            hits_per_page=1,  # We only need facets
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Search service error: {str(e)}")

    return {
        "facets": result.facets,
        "query": q,
    }


@router.get("/stats", response_model=SearchStatsResponse)
async def get_search_stats():
    """
    Get search index statistics.

    Returns information about the search index including
    document count and indexing status.

    Returns:
        Index statistics
    """
    search_service = get_search_service()

    try:
        stats = await search_service.get_index_stats()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Search service error: {str(e)}")

    return SearchStatsResponse(**stats)


@router.post("/reindex")
async def trigger_reindex(
    db: DBSession,
):
    """
    Trigger a full reindex of all books.

    This is an admin operation that rebuilds the entire search index.
    Should be used sparingly as it can be resource-intensive.

    Returns:
        Reindex operation results
    """
    search_service = get_search_service()

    # Get all books from database
    books, _ = await book_crud.get_multi(db, skip=0, limit=10000)

    try:
        result = await search_service.reindex_all_books(list(books))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reindex failed: {str(e)}")

    return {
        "status": "completed",
        "indexed": result["indexed"],
        "failed": result["failed"],
        "total": result["total"],
    }


# ============ Legacy Endpoints (for backwards compatibility) ============

@router.get("/legacy", response_model=BookListResponse)
async def search_books_legacy(
    db: DBSession,
    q: Annotated[str, Query(min_length=1, description="Search query")],
    category: str | None = None,
    author: str | None = None,
    language: str | None = None,
    year_from: Annotated[int | None, Query(ge=1000)] = None,
    year_to: Annotated[int | None, Query(le=2100)] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """
    Legacy search endpoint using database queries.

    This endpoint uses PostgreSQL LIKE queries instead of Meilisearch.
    Kept for backwards compatibility.
    """
    file_service = get_file_service()

    books, total = await book_crud.search(
        db,
        query=q,
        category=category,
        author=author,
        language=language,
        year_from=year_from,
        year_to=year_to,
        skip=skip,
        limit=limit,
    )

    # Generate download URLs
    items = []
    for book in books:
        response = BookResponse.model_validate(book)
        try:
            response.download_url = await file_service.get_download_url(book.file_path)
        except Exception:
            response.download_url = None
        items.append(response)

    return BookListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
        has_more=(skip + len(items)) < total,
    )
