"""
Celery application configuration for background tasks.
"""
from celery import Celery
from app.core.config import settings

# Create Celery app
celery_app = Celery(
    "literature_aggregator",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.tasks.external_books"],
)

# Celery configuration
celery_app.conf.update(
    # Task settings
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,

    # Task execution settings
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_time_limit=300,  # 5 minutes max
    task_soft_time_limit=240,  # 4 minutes soft limit

    # Result backend settings
    result_expires=3600,  # 1 hour

    # Worker settings
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=100,

    # Rate limiting
    task_default_rate_limit="10/m",

    # Beat scheduler for periodic tasks
    beat_schedule={
        "update-external-metadata-daily": {
            "task": "app.tasks.external_books.update_stale_metadata",
            "schedule": 86400.0,  # 24 hours
            "options": {"queue": "periodic"},
        },
    },

    # Task routing
    task_routes={
        "app.tasks.external_books.update_stale_metadata": {"queue": "periodic"},
        "app.tasks.external_books.bulk_import_books": {"queue": "bulk"},
        "app.tasks.external_books.*": {"queue": "default"},
    },
)


def get_celery_app() -> Celery:
    """Get the Celery app instance."""
    return celery_app
