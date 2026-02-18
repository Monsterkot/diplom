"""
User management endpoints.
"""
from fastapi import APIRouter, HTTPException, status

from app.crud.user import user_crud
from app.schemas.user import UserResponse
from app.services.auth import CurrentUser, CurrentSuperuser, DBSession

router = APIRouter()


@router.get("/", response_model=list[UserResponse])
async def get_users(
    db: DBSession,
    current_user: CurrentSuperuser,  # Only superusers can list users
    skip: int = 0,
    limit: int = 100,
):
    """
    Get list of all users (superuser only).
    """
    users = await user_crud.get_multi(db, skip=skip, limit=limit)
    return users


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Get user by ID.

    Users can only view their own profile unless they are superusers.
    """
    if current_user.id != user_id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this user",
        )

    user = await user_crud.get(db, id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: DBSession,
    current_user: CurrentSuperuser,  # Only superusers can delete users
):
    """
    Delete a user (superuser only).
    """
    user = await user_crud.get(db, id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Prevent self-deletion
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself",
        )

    await user_crud.delete(db, id=user_id)
