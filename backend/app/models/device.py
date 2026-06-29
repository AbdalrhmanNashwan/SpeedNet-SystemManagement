"""Device models — links (PTP), switches, sectors (APs), servers.

All carry tower_id (FK) and a `flags` list (no-access / virtual / placeholder-pass /
incomplete) computed at import time. Kept as separate tables (not one polymorphic
table) because their columns differ and queries are clearer.
"""
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, func, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class _DeviceCommon:
    id: Mapped[int] = mapped_column(primary_key=True)
    flags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    note: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Link(_DeviceCommon, Base):
    __tablename__ = "links"
    tower_id: Mapped[int] = mapped_column(ForeignKey("towers.id", ondelete="CASCADE"), index=True)
    ssid: Mapped[str | None] = mapped_column(String)
    device_name: Mapped[str | None] = mapped_column(String)
    device_type: Mapped[str | None] = mapped_column(String)
    wireless_pass: Mapped[str | None] = mapped_column(String)
    unlock_code: Mapped[str | None] = mapped_column(String)
    serial_number: Mapped[str | None] = mapped_column(String)
    mac_address: Mapped[str | None] = mapped_column(String)
    username: Mapped[str | None] = mapped_column(String)
    password: Mapped[str | None] = mapped_column(String)
    ip: Mapped[str | None] = mapped_column(String)
    gateway: Mapped[str | None] = mapped_column(String)
    subnet: Mapped[str | None] = mapped_column(String)
    vlan: Mapped[str | None] = mapped_column(String)
    port: Mapped[str | None] = mapped_column(String)
    target: Mapped[str | None] = mapped_column(String)
    tower: Mapped["Tower"] = relationship(back_populates="links")


class Switch(_DeviceCommon, Base):
    __tablename__ = "switches"
    tower_id: Mapped[int] = mapped_column(ForeignKey("towers.id", ondelete="CASCADE"), index=True)
    ip: Mapped[str | None] = mapped_column(String)
    username: Mapped[str | None] = mapped_column(String)
    password: Mapped[str | None] = mapped_column(String)
    model: Mapped[str | None] = mapped_column(String)
    gateway: Mapped[str | None] = mapped_column(String)
    subnet: Mapped[str | None] = mapped_column(String)
    tower: Mapped["Tower"] = relationship(back_populates="switches")


class Sector(_DeviceCommon, Base):
    __tablename__ = "sectors"
    tower_id: Mapped[int] = mapped_column(ForeignKey("towers.id", ondelete="CASCADE"), index=True)
    ssid: Mapped[str | None] = mapped_column(String)
    device_name: Mapped[str | None] = mapped_column(String)
    device_type: Mapped[str | None] = mapped_column(String)
    wireless_pass: Mapped[str | None] = mapped_column(String)
    serial_number: Mapped[str | None] = mapped_column(String)
    mac_address: Mapped[str | None] = mapped_column(String)
    username: Mapped[str | None] = mapped_column(String)
    password: Mapped[str | None] = mapped_column(String)
    ip: Mapped[str | None] = mapped_column(String)
    gateway: Mapped[str | None] = mapped_column(String)
    subnet: Mapped[str | None] = mapped_column(String)
    tower: Mapped["Tower"] = relationship(back_populates="sectors")


class Server(_DeviceCommon, Base):
    __tablename__ = "servers"
    tower_id: Mapped[int] = mapped_column(ForeignKey("towers.id", ondelete="CASCADE"), index=True)
    device_name: Mapped[str | None] = mapped_column(String)
    username: Mapped[str | None] = mapped_column(String)
    password: Mapped[str | None] = mapped_column(String)
    url: Mapped[str | None] = mapped_column(String)
    tower: Mapped["Tower"] = relationship(back_populates="servers")
