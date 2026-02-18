"""
Meilisearch client configuration and index management.
"""
from meilisearch_python_sdk import AsyncClient
from meilisearch_python_sdk.models.settings import MeilisearchSettings
from typing import Any

from app.core.config import settings


# Index names
BOOKS_INDEX = "books"
EXTERNAL_BOOKS_INDEX = "external_books"

# Searchable attributes for books index
BOOKS_SEARCHABLE_ATTRIBUTES = [
    "title",
    "author",
    "description",
    "content",  # Extracted text content
    "publisher",
    "isbn",
    "category",
    "tags",
]

# Filterable attributes for books index
BOOKS_FILTERABLE_ATTRIBUTES = [
    "author",
    "category",
    "language",
    "published_year",
    "content_type",
    "source",
    "uploaded_by_id",
]

# Sortable attributes for books index
BOOKS_SORTABLE_ATTRIBUTES = [
    "title",
    "author",
    "published_year",
    "created_at",
    "file_size",
]

# Ranking rules
BOOKS_RANKING_RULES = [
    "words",
    "typo",
    "proximity",
    "attribute",
    "sort",
    "exactness",
]


class MeilisearchClient:
    """Wrapper for Meilisearch client with index management."""

    def __init__(self):
        self._async_client: AsyncClient | None = None

    async def get_async_client(self) -> AsyncClient:
        """Get async Meilisearch client."""
        if self._async_client is None:
            self._async_client = AsyncClient(
                settings.meili_url,
                settings.meili_master_key
            )
        return self._async_client

    async def close(self):
        """Close async client."""
        if self._async_client:
            await self._async_client.aclose()
            self._async_client = None

    async def initialize_indexes(self):
        """Initialize all required indexes with proper settings."""
        client = await self.get_async_client()

        # Create books index
        try:
            await client.create_index(
                BOOKS_INDEX,
                primary_key="id"
            )
        except Exception:
            # Index might already exist
            pass

        # Configure books index settings
        books_index = client.index(BOOKS_INDEX)
        await books_index.update_settings(
            MeilisearchSettings(
                searchable_attributes=BOOKS_SEARCHABLE_ATTRIBUTES,
                filterable_attributes=BOOKS_FILTERABLE_ATTRIBUTES,
                sortable_attributes=BOOKS_SORTABLE_ATTRIBUTES,
                ranking_rules=BOOKS_RANKING_RULES,
                typo_tolerance={
                    "enabled": True,
                    "minWordSizeForTypos": {
                        "oneTypo": 4,
                        "twoTypos": 8
                    }
                },
                pagination={
                    "maxTotalHits": 10000
                }
            )
        )

        # Create external books index
        try:
            await client.create_index(
                EXTERNAL_BOOKS_INDEX,
                primary_key="id"
            )
        except Exception:
            pass

        # Configure external books index
        external_index = client.index(EXTERNAL_BOOKS_INDEX)
        await external_index.update_settings(
            MeilisearchSettings(
                searchable_attributes=[
                    "title",
                    "authors",
                    "description",
                    "publisher",
                    "isbn_10",
                    "isbn_13",
                    "categories",
                ],
                filterable_attributes=[
                    "source",
                    "language",
                    "published_year",
                    "is_imported",
                    "categories",
                ],
                sortable_attributes=[
                    "title",
                    "published_year",
                    "average_rating",
                    "created_at",
                ],
            )
        )

    async def get_index_stats(self, index_name: str) -> dict[str, Any]:
        """Get statistics for an index."""
        client = await self.get_async_client()
        index = client.index(index_name)
        stats = await index.get_stats()
        return {
            "number_of_documents": stats.number_of_documents,
            "is_indexing": stats.is_indexing,
            "field_distribution": stats.field_distribution,
        }

    async def health_check(self) -> bool:
        """Check if Meilisearch is healthy."""
        try:
            client = await self.get_async_client()
            health = await client.health()
            return health.status == "available"
        except Exception:
            return False


# Singleton instance
_meili_client: MeilisearchClient | None = None


def get_meili_client() -> MeilisearchClient:
    """Get singleton Meilisearch client."""
    global _meili_client
    if _meili_client is None:
        _meili_client = MeilisearchClient()
    return _meili_client


async def init_meilisearch():
    """Initialize Meilisearch indexes on startup."""
    client = get_meili_client()
    await client.initialize_indexes()


async def close_meilisearch():
    """Close Meilisearch client on shutdown."""
    global _meili_client
    if _meili_client:
        await _meili_client.close()
        _meili_client = None
