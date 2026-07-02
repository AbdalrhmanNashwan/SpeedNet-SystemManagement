"""User model for auth + RBAC."""
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Integer, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, default="viewer")  # admin/editor/viewer/agent
    # for agent scope: restrict to one zone (extend to many via a join table later)
    zone_id: Mapped[int | None] = mapped_column(ForeignKey("zones.id", ondelete="SET NULL"))
    # Per-user write capabilities. Viewing is always allowed (within the user's
    # scope); these three gate create/update/delete. Admins implicitly have all
    # three regardless of the flags. Applies to agents too — an agent with these
    # can create/update/delete, but only within their own zone.
    can_create: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false", default=False)
    can_update: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false", default=False)
    can_delete: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false", default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # bumped on logout / password change / deactivate to invalidate old JWTs
    token_version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
