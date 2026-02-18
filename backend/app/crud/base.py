"""
Base CRUD class with common operations.
"""
from typing import TypeVar, Generic, Type, Any, Sequence
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import Base

ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """
    Base class for CRUD operations.

    Provides common database operations:
    - get: Get single record by ID
    - get_multi: Get multiple records with pagination
    - create: Create new record
    - update: Update existing record
    - delete: Delete record
    """

    def __init__(self, model: Type[ModelType]):
        self.model = model

    async def get(self, db: AsyncSession, id: int) -> ModelType | None:
        """Get a single record by ID."""
        result = await db.execute(
            select(self.model).where(self.model.id == id)
        )
        return result.scalar_one_or_none()

    async def get_multi(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[ModelType]:
        """Get multiple records with pagination."""
        result = await db.execute(
            select(self.model)
            .offset(skip)
            .limit(limit)
            .order_by(self.model.id.desc())
        )
        return result.scalars().all()

    async def count(self, db: AsyncSession) -> int:
        """Get total count of records."""
        result = await db.execute(
            select(func.count()).select_from(self.model)
        )
        return result.scalar_one()

    async def create(
        self,
        db: AsyncSession,
        *,
        obj_in: CreateSchemaType | dict[str, Any],
    ) -> ModelType:
        """Create a new record."""
        if isinstance(obj_in, dict):
            obj_data = obj_in
        else:
            obj_data = obj_in.model_dump(exclude_unset=True)

        db_obj = self.model(**obj_data)
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def update(
        self,
        db: AsyncSession,
        *,
        db_obj: ModelType,
        obj_in: UpdateSchemaType | dict[str, Any],
    ) -> ModelType:
        """Update an existing record."""
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            if hasattr(db_obj, field):
                setattr(db_obj, field, value)

        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def delete(self, db: AsyncSession, *, id: int) -> bool:
        """Delete a record by ID."""
        result = await db.execute(
            delete(self.model).where(self.model.id == id)
        )
        return result.rowcount > 0
