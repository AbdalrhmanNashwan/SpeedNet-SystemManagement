"""Audit log — one row per create/update/delete/transfer."""
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, JSON, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer)
    user_email: Mapped[str | None] = mapped_column(String)
    action: Mapped[str] = mapped_column(String)        # create/update/delete/transfer
    entity: Mapped[str] = mapped_column(String)        # tower/link/switch/sector/...
    entity_id: Mapped[int | None] = mapped_column(Integer)
    changes: Mapped[dict | None] = mapped_column(JSON) # {field: [old, new]} or snapshot
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
