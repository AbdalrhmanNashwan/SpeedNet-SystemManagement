"""Generic async CRUD base, reused by entity-specific CRUD modules."""
from typing import Generic, TypeVar, Type, Any
from sqlalchemy import select, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class CRUDBase(Generic[ModelT]):
    def __init__(self, model: Type[ModelT]):
        self.model = model

    async def get(self, db: AsyncSession, id: int) -> ModelT | None:
        res = await db.execute(select(self.model).where(self.model.id == id))
        return res.scalar_one_or_none()

    async def list(self, db: AsyncSession, **filters: Any) -> list[ModelT]:
        stmt = select(self.model)
        for k, v in filters.items():
            if v is not None and hasattr(self.model, k):
                stmt = stmt.where(getattr(self.model, k) == v)
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def create(self, db: AsyncSession, data: dict) -> ModelT:
        obj = self.model(**data)
        db.add(obj)
        await db.commit()
        await db.refresh(obj)
        return obj

    async def update(self, db: AsyncSession, obj: ModelT, data: dict) -> ModelT:
        for k, v in data.items():
            setattr(obj, k, v)
        await db.commit()
        await db.refresh(obj)
        return obj

    async def delete(self, db: AsyncSession, obj: ModelT) -> None:
        await db.delete(obj)
        await db.commit()
