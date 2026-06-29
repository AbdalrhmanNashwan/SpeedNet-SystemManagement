"""Zone model — the top-level bubbles (SPEED, سنوني)."""
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Zone(Base):
    __tablename__ = "zones"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    tag: Mapped[str | None] = mapped_column(String)          # "Company network", "Area zone"
    color: Mapped[str | None] = mapped_column(String)        # token name: blue/yellow/...
    icon: Mapped[str | None] = mapped_column(String)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    # optional auto-fill rule
    rule_field: Mapped[str | None] = mapped_column(String)   # 'reseller' | 'area' | None
    rule_value: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    towers: Mapped[list["Tower"]] = relationship(back_populates="zone")
