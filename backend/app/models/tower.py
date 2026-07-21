"""Tower model — the parent of all device tables."""
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Tower(Base):
    __tablename__ = "towers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False, index=True)  # original sheet name
    agent: Mapped[str | None] = mapped_column(String)
    agency_id: Mapped[str | None] = mapped_column(String)
    reseller: Mapped[str | None] = mapped_column(String, index=True)
    affiliate: Mapped[str | None] = mapped_column(String)
    phone: Mapped[str | None] = mapped_column(String)
    link_type: Mapped[str | None] = mapped_column(String)
    switch_type: Mapped[str | None] = mapped_column(String)
    user_count: Mapped[str | None] = mapped_column(String)
    vlan: Mapped[str | None] = mapped_column(String)
    admin_page: Mapped[str | None] = mapped_column(String)
    admin_pass: Mapped[str | None] = mapped_column(String)
    area: Mapped[str | None] = mapped_column(String, index=True)
    gps_lat: Mapped[str | None] = mapped_column(String)
    gps_lng: Mapped[str | None] = mapped_column(String)
    height: Mapped[str | None] = mapped_column(String)
    parent_name: Mapped[str | None] = mapped_column(String)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("towers.id", ondelete="SET NULL"))
    port: Mapped[str | None] = mapped_column(String)
    # Service source — the four parts of a note like "328-bpwatani452-eth5-tag":
    # switch model / source switch / port / tag mode. Used to trace outages
    # upstream. (VLAN lives in the `vlan` field above — not duplicated here.)
    feed_model: Mapped[str | None] = mapped_column(String)  # switch model, e.g. 328
    fed_by: Mapped[str | None] = mapped_column(String)      # source switch, e.g. bpwatani452
    feed_port: Mapped[str | None] = mapped_column(String)   # port on that switch, e.g. eth5
    feed_mode: Mapped[str | None] = mapped_column(String)   # 'tag' | 'untag'
    status: Mapped[str] = mapped_column(String, default="Active", index=True)
    notes: Mapped[str | None] = mapped_column(String)
    zone_id: Mapped[int | None] = mapped_column(ForeignKey("zones.id", ondelete="SET NULL"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    zone: Mapped["Zone"] = relationship(back_populates="towers")
    links: Mapped[list["Link"]] = relationship(back_populates="tower", cascade="all, delete-orphan")
    switches: Mapped[list["Switch"]] = relationship(back_populates="tower", cascade="all, delete-orphan")
    sectors: Mapped[list["Sector"]] = relationship(back_populates="tower", cascade="all, delete-orphan")
    servers: Mapped[list["Server"]] = relationship(back_populates="tower", cascade="all, delete-orphan")
