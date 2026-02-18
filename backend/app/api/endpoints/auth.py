"""
Authentication endpoints.
"""
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.config import settings
from app.crud.user import user_crud
from app.schemas.user import Token, UserCreate, UserResponse
from app.services.auth import create_access_token, CurrentUser, DBSession

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreate,
    db: DBSession,
):
    """
    Register a new user.

    - **email**: User's email address (must be unique)
    - **username**: User's username (must be unique)
    - **password**: Password (min 8 characters, must contain uppercase, lowercase, digit)
    """
    # Check if email already exists
    existing_user = await user_crud.get_by_email(db, email=user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Check if username already exists
    existing_user = await user_crud.get_by_username(db, username=user_in.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken",
        )

    # Create new user
    user = await user_crud.create(db, obj_in=user_in)
    return user


@router.post("/login", response_model=Token)
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: DBSession,
):
    """
    Login to get access token.

    Uses OAuth2 password flow:
    - **username**: Email address
    - **password**: User password
    """
    user = await user_crud.authenticate(
        db,
        email=form_data.username,  # OAuth2 uses "username" field
        password=form_data.password,
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    # Create access token
    access_token = create_access_token(
        subject=user.id,
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,  # seconds
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: CurrentUser):
    """
    Get current authenticated user information.
    """
    return current_user


@router.post("/logout")
async def logout(current_user: CurrentUser):
    """
    Logout current user.

    Note: Since we use stateless JWT tokens, this endpoint is mainly for
    client-side token removal. For full logout, implement token blacklisting.
    """
    return {"message": "Successfully logged out"}
