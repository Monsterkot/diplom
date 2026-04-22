"""
Admin endpoints for managing users, books, and audit logs.
"""
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import selectinload

from app.core.access import BookStatus, UserRole
from app.core.config import settings
from app.crud.book import book_crud
from app.crud.user import user_crud
from app.models.audit_log import AuditLog
from app.schemas.admin import (
    AdminServiceCredentialsResponse,
    AdminAuditLogsListResponse,
    AdminBooksListResponse,
    AdminStatsResponse,
    AdminUsersListResponse,
    AuditLogResponse,
    ServiceCredentialResponse,
    UpdateBookStatusRequest,
    UpdateUserBlockRequest,
    UpdateUserRoleRequest,
)
from app.schemas.book import BookResponse
from app.schemas.common import MessageResponse
from app.schemas.user import UserResponse, UserSummary
from app.services.auth import CurrentAdmin, CurrentModeratorOrAdmin, DBSession
from app.services.file_service import file_service
from app.services.search_service import get_search_service

router = APIRouter(prefix="/admin", tags=["Admin"])


async def create_audit_log(
    db: DBSession,
    *,
    actor_user_id: int | None,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    details: dict | None = None,
) -> None:
    """Store an audit log entry inside the current transaction."""

    db.add(
        AuditLog(
            actor_user_id=actor_user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
        )
    )
    await db.flush()


def serialize_audit_log(entry: AuditLog) -> AuditLogResponse:
    """Serialize an audit log entry for API responses."""

    return AuditLogResponse(
        id=entry.id,
        action=entry.action,
        entity_type=entry.entity_type,
        entity_id=entry.entity_id,
        details=entry.details,
        actor=UserSummary.model_validate(entry.actor) if entry.actor else None,
        created_at=entry.created_at,
    )


def _local_url_from_internal(raw_url: str) -> str:
    """Convert internal Docker URLs into localhost-friendly access URLs."""

    parsed = make_url(raw_url)
    drivername = parsed.drivername.split("+", 1)[0]
    host = parsed.host or "localhost"
    port = parsed.port

    if host in {"postgres", "meilisearch", "redis", "minio", "backend", "frontend"}:
        host = "localhost"

    auth = ""
    if parsed.username:
        auth = parsed.username
        if parsed.password:
            auth += ":***"
        auth += "@"

    database = f"/{parsed.database}" if parsed.database else ""

    return f"{drivername}://{auth}{host}{f':{port}' if port else ''}{database}"


@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    db: DBSession,
    current_user: CurrentModeratorOrAdmin,
):
    """Get dashboard statistics for the admin area."""

    return AdminStatsResponse(
        total_users=await user_crud.count(db),
        active_users=await user_crud.count_filtered(db, is_active=True),
        blocked_users=await user_crud.count_filtered(db, is_blocked=True),
        admin_users=await user_crud.count_filtered(db, role=UserRole.ADMIN),
        moderator_users=await user_crud.count_filtered(db, role=UserRole.MODERATOR),
        total_books=await book_crud.count(db),
        published_books=await book_crud.count(db, status=BookStatus.PUBLISHED),
        hidden_books=await book_crud.count(db, status=BookStatus.HIDDEN),
        uploaded_books=await book_crud.count_filtered(db, source="upload"),
        imported_books=await book_crud.count_filtered(db, source="external"),
    )


@router.get("/service-credentials", response_model=AdminServiceCredentialsResponse)
async def get_service_credentials(
    current_user: CurrentAdmin,
):
    """Get infrastructure access credentials for administrators."""

    _ = current_user
    database_url = make_url(settings.database_url)

    minio_public_host = settings.minio_public_endpoint.split(":", 1)[0]
    minio_console_url = f"http://{minio_public_host}:9001"
    minio_api_scheme = "https" if settings.minio_public_secure else "http"
    minio_api_url = f"{minio_api_scheme}://{settings.minio_public_endpoint}"

    items = [
        ServiceCredentialResponse(
            service_name="MinIO Console",
            description="Object storage web console for files and covers.",
            access_type="web",
            url=minio_console_url,
            username=settings.minio_access_key,
            password=settings.minio_secret_key,
            notes=f"S3 API endpoint: {minio_api_url}. Bucket: {settings.minio_bucket}.",
        ),
        ServiceCredentialResponse(
            service_name="Meilisearch",
            description="Full-text search service.",
            access_type="api_key",
            url=_local_url_from_internal(settings.meili_url),
            password=settings.meili_master_key,
            notes="Use the master key for API requests or dashboard access.",
        ),
        ServiceCredentialResponse(
            service_name="PostgreSQL",
            description="Primary application database.",
            access_type="database",
            url=_local_url_from_internal(settings.database_url),
            username=database_url.username,
            password=database_url.password,
            database=database_url.database,
            notes="Connect using a PostgreSQL client such as DBeaver, TablePlus, or psql.",
        ),
        ServiceCredentialResponse(
            service_name="Redis",
            description="Broker and storage for background jobs.",
            access_type="redis",
            url=_local_url_from_internal(settings.redis_url),
            notes=(
                f"Celery broker: {_local_url_from_internal(settings.celery_broker_url)}. "
                f"Celery results: {_local_url_from_internal(settings.celery_result_backend)}."
            ),
        ),
    ]

    return AdminServiceCredentialsResponse(items=items)


@router.get("/users", response_model=AdminUsersListResponse)
async def get_admin_users(
    db: DBSession,
    current_user: CurrentAdmin,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """Get a paginated list of users."""

    users = await user_crud.get_multi(db, skip=skip, limit=limit)
    total = await user_crud.count(db)
    items = [UserResponse.model_validate(user) for user in users]

    return AdminUsersListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
        has_more=(skip + len(items)) < total,
    )


@router.patch("/users/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: int,
    payload: UpdateUserRoleRequest,
    db: DBSession,
    current_user: CurrentAdmin,
):
    """Update a user's role."""

    user = await user_crud.get(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot change your own role")

    user.role = payload.role.value
    user.is_superuser = payload.role == UserRole.ADMIN
    updated_user = await user_crud.update(
        db,
        db_obj=user,
        obj_in={"role": user.role, "is_superuser": user.is_superuser},
    )
    await create_audit_log(
        db,
        actor_user_id=current_user.id,
        action="user_role_updated",
        entity_type="user",
        entity_id=updated_user.id,
        details={
            "target_email": updated_user.email,
            "target_username": updated_user.username,
            "new_role": updated_user.role,
        },
    )
    return UserResponse.model_validate(updated_user)


@router.patch("/users/{user_id}/block", response_model=UserResponse)
async def update_user_block_status(
    user_id: int,
    payload: UpdateUserBlockRequest,
    db: DBSession,
    current_user: CurrentAdmin,
):
    """Block or unblock a user."""

    user = await user_crud.get(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id and payload.is_blocked:
        raise HTTPException(status_code=400, detail="You cannot block your own account")

    updated_user = await user_crud.update(
        db,
        db_obj=user,
        obj_in={"is_blocked": payload.is_blocked},
    )
    await create_audit_log(
        db,
        actor_user_id=current_user.id,
        action="user_block_updated",
        entity_type="user",
        entity_id=updated_user.id,
        details={
            "target_email": updated_user.email,
            "target_username": updated_user.username,
            "is_blocked": updated_user.is_blocked,
        },
    )
    return UserResponse.model_validate(updated_user)


@router.get("/books", response_model=AdminBooksListResponse)
async def get_admin_books(
    db: DBSession,
    current_user: CurrentModeratorOrAdmin,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    status: BookStatus | None = Query(None, description="Filter by book status"),
):
    """Get a paginated list of books for content moderation."""

    books = await book_crud.get_multi(db, skip=skip, limit=limit, status=status)
    total = await book_crud.count(db, status=status)
    items: list[BookResponse] = []

    for book in books:
        response = BookResponse.model_validate(book)
        try:
            response.download_url = await file_service.get_file_url(book.file_path)
        except Exception:
            response.download_url = None
        items.append(response)

    return AdminBooksListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
        has_more=(skip + len(items)) < total,
    )


@router.patch("/books/{book_id}/status", response_model=BookResponse)
async def update_book_status(
    book_id: int,
    payload: UpdateBookStatusRequest,
    db: DBSession,
    current_user: CurrentModeratorOrAdmin,
):
    """Update a book visibility status."""

    book = await book_crud.get_with_user(db, id=book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    previous_status = book.status
    updated_book = await book_crud.update(
        db,
        db_obj=book,
        obj_in={"status": payload.status.value},
    )
    await create_audit_log(
        db,
        actor_user_id=current_user.id,
        action="book_status_updated",
        entity_type="book",
        entity_id=updated_book.id,
        details={
            "title": updated_book.title,
            "previous_status": previous_status,
            "new_status": updated_book.status,
        },
    )

    try:
        search_service = get_search_service()
        await search_service.sync_book_visibility(updated_book)
    except Exception:
        pass

    refreshed_book = await book_crud.get_with_user(db, id=updated_book.id)
    if not refreshed_book:
        raise HTTPException(status_code=404, detail="Book not found after update")

    response = BookResponse.model_validate(refreshed_book)
    try:
        response.download_url = await file_service.get_file_url(refreshed_book.file_path)
    except Exception:
        response.download_url = None
    return response


@router.delete("/books/{book_id}", response_model=MessageResponse)
async def admin_delete_book(
    book_id: int,
    db: DBSession,
    current_user: CurrentModeratorOrAdmin,
):
    """Delete a book as a moderator or administrator."""

    book = await book_crud.get(db, id=book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    audit_details = {
        "title": book.title,
        "author": book.author,
        "uploaded_by_id": book.uploaded_by_id,
        "status": book.status,
    }

    try:
        search_service = get_search_service()
        await search_service.delete_book_from_index(book_id)
    except Exception:
        pass

    try:
        await file_service.delete_file(book.file_path)
        if book.cover_path:
            await file_service.delete_file(book.cover_path)
    except Exception:
        pass

    await book_crud.delete(db, id=book_id)
    await create_audit_log(
        db,
        actor_user_id=current_user.id,
        action="book_deleted",
        entity_type="book",
        entity_id=book_id,
        details=audit_details,
    )
    return MessageResponse(message="Book deleted successfully")


@router.get("/audit-logs", response_model=AdminAuditLogsListResponse)
async def get_audit_logs(
    db: DBSession,
    current_user: CurrentAdmin,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """Get a paginated list of audit log entries."""

    result = await db.execute(
        select(AuditLog)
        .options(selectinload(AuditLog.actor))
        .offset(skip)
        .limit(limit)
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
    )
    entries = result.scalars().all()

    total_result = await db.execute(select(func.count()).select_from(AuditLog))
    total = total_result.scalar_one()

    return AdminAuditLogsListResponse(
        items=[serialize_audit_log(entry) for entry in entries],
        total=total,
        skip=skip,
        limit=limit,
        has_more=(skip + len(entries)) < total,
    )
