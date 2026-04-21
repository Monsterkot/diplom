"""
CRUD operations for User model.
"""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.core.access import UserRole, is_admin_role
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse
from app.services.auth import get_password_hash, verify_password


class CRUDUser(CRUDBase[User, UserCreate, UserResponse]):
    """CRUD operations for User model."""

    async def get_by_email(self, db: AsyncSession, email: str) -> User | None:
        """Get user by email."""
        result = await db.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()

    async def get_by_username(self, db: AsyncSession, username: str) -> User | None:
        """Get user by username."""
        result = await db.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()

    async def create(self, db: AsyncSession, *, obj_in: UserCreate) -> User:
        """Create a new user with hashed password."""
        db_obj = User(
            email=obj_in.email,
            username=obj_in.username,
            hashed_password=get_password_hash(obj_in.password),
            is_active=True,
            is_superuser=False,
            role=UserRole.USER.value,
            is_blocked=False,
        )
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def authenticate(
        self,
        db: AsyncSession,
        *,
        email: str,
        password: str,
    ) -> User | None:
        """Authenticate user by email and password."""
        user = await self.get_by_email(db, email)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    async def is_active(self, user: User) -> bool:
        """Check if user is active."""
        return user.is_active

    async def is_superuser(self, user: User) -> bool:
        """Check if user is superuser."""
        return user.is_superuser or is_admin_role(user.role)

    async def count_filtered(
        self,
        db: AsyncSession,
        *,
        is_active: bool | None = None,
        is_blocked: bool | None = None,
        role: UserRole | None = None,
    ) -> int:
        """Count users with optional filters."""

        conditions = []
        if is_active is not None:
            conditions.append(User.is_active == is_active)
        if is_blocked is not None:
            conditions.append(User.is_blocked == is_blocked)
        if role is not None:
            conditions.append(User.role == role.value)

        result = await db.execute(
            select(func.count()).select_from(User).where(*conditions)
        )
        return result.scalar_one()

    async def update_password(
        self,
        db: AsyncSession,
        *,
        user: User,
        new_password: str,
    ) -> User:
        """Update user password."""
        user.hashed_password = get_password_hash(new_password)
        db.add(user)
        await db.flush()
        await db.refresh(user)
        return user


# Singleton instance
user_crud = CRUDUser(User)
