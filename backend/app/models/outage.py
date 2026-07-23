"""Outage history — one row per confirmed down→up cycle for a monitored IP.

The live monitor keeps everything in memory, so a restart wipes it. That makes
the question the business actually cares about — "how much downtime did this
tower have last month?" — unanswerable. This table is the durable record.

A row is opened when an IP is confirmed down and closed when it recovers;
`ended_at IS NULL` means the outage is still ongoing.
"""
from datetime import datetime

from sqlalchemy import String, Integer, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class OutageEvent(Base):
    __tablename__ = "outage_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    ip: Mapped[str] = mapped_column(String, index=True)

    # Denormalised on purpose: the tower a device belongs to can be renamed or
    # the device deleted, and history must still read correctly afterwards.
    # tower_id keeps the link for zone scoping while the row exists.
    tower_id: Mapped[int | None] = mapped_column(
        ForeignKey("towers.id", ondelete="SET NULL"), index=True)
    tower_name: Mapped[str | None] = mapped_column(String)
    label: Mapped[str | None] = mapped_column(String)   # "P2P link", "Switch", …

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    # NULL while the outage is still ongoing.
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Stored rather than computed at query time so uptime aggregates stay a
    # plain SUM instead of a per-row interval calculation.
    duration_seconds: Mapped[int | None] = mapped_column(Integer)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now())


# Finding the still-open outage for an IP happens on every sweep, and the
# uptime report scans by time window — both deserve an index.
Index("ix_outage_events_ip_open", OutageEvent.ip, OutageEvent.ended_at)
Index("ix_outage_events_started_ended", OutageEvent.started_at, OutageEvent.ended_at)
