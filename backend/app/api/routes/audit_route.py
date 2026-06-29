"""Read-only audit log — admin/editor."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_role
from app.models.audit import AuditLog
from app.models.user import User
from pydantic import BaseModel, ConfigDict
from datetime import datetime

router = APIRouter(prefix="/audit", tags=["audit"])


class AuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_email: str | None
    action: str
    entity: str
    entity_id: int | None
    changes: dict | None
    created_at: datetime


@router.get("", response_model=list[AuditOut])
async def list_audit(limit: int = 100, offset: int = 0,
                     entity: str | None = None, action: str | None = None,
                     q: str | None = None,
                     db: AsyncSession = Depends(get_db),
                     user: User = Depends(require_role("admin"))):
    """History feed, newest first. Filters: entity, action, and `q` (matches the
    acting user's email). `limit`/`offset` paginate."""
    stmt = select(AuditLog).order_by(AuditLog.id.desc())
    if entity:
        stmt = stmt.where(AuditLog.entity == entity)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if q:
        stmt = stmt.where(AuditLog.user_email.ilike(f"%{q}%"))
    stmt = stmt.limit(min(limit, 500)).offset(offset)
    res = await db.execute(stmt)
    return list(res.scalars().all())
