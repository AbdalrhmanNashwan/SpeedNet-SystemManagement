"""Standalone tables: IP allocations, backbone feeds, routing points, subscribers."""
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class IPAllocation(Base):
    __tablename__ = "ip_allocations"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner: Mapped[str | None] = mapped_column(String)
    point: Mapped[str | None] = mapped_column(String)
    tower_ref: Mapped[str | None] = mapped_column(String)
    tower_id: Mapped[int | None] = mapped_column(ForeignKey("towers.id", ondelete="SET NULL"))
    link_type: Mapped[str | None] = mapped_column(String)
    parent: Mapped[str | None] = mapped_column(String)
    vlan: Mapped[str | None] = mapped_column(String)
    ip_block: Mapped[str | None] = mapped_column(String)
    ip_master: Mapped[str | None] = mapped_column(String)
    user_master: Mapped[str | None] = mapped_column(String)
    pass_master: Mapped[str | None] = mapped_column(String)
    ip_slave: Mapped[str | None] = mapped_column(String)
    user_slave: Mapped[str | None] = mapped_column(String)
    pass_slave: Mapped[str | None] = mapped_column(String)
    sw_ip: Mapped[str | None] = mapped_column(String)
    sw_pass: Mapped[str | None] = mapped_column(String)
    rs_pass: Mapped[str | None] = mapped_column(String)
    note: Mapped[str | None] = mapped_column(String)


class BackboneFeed(Base):
    __tablename__ = "backbone_feeds"
    id: Mapped[int] = mapped_column(primary_key=True)
    switch_name: Mapped[str | None] = mapped_column(String)
    switch_ip: Mapped[str | None] = mapped_column(String)
    port: Mapped[str | None] = mapped_column(String)
    feeds_name: Mapped[str | None] = mapped_column(String)        # raw downstream tower name
    feeds_tower_id: Mapped[int | None] = mapped_column(ForeignKey("towers.id", ondelete="SET NULL"))
    ssid: Mapped[str | None] = mapped_column(String)
    vlan: Mapped[str | None] = mapped_column(String)
    ip: Mapped[str | None] = mapped_column(String)
    model: Mapped[str | None] = mapped_column(String)


class RoutingPoint(Base):
    __tablename__ = "routing_points"
    id: Mapped[int] = mapped_column(primary_key=True)
    group_name: Mapped[str | None] = mapped_column(String)
    owner: Mapped[str | None] = mapped_column(String)
    point: Mapped[str | None] = mapped_column(String)
    link_type: Mapped[str | None] = mapped_column(String)
    parent: Mapped[str | None] = mapped_column(String)
    vlan: Mapped[str | None] = mapped_column(String)
    ip_gateway: Mapped[str | None] = mapped_column(String)
    ip_master: Mapped[str | None] = mapped_column(String)
    user_master: Mapped[str | None] = mapped_column(String)
    pass_master: Mapped[str | None] = mapped_column(String)
    ip_slave: Mapped[str | None] = mapped_column(String)
    note: Mapped[str | None] = mapped_column(String)


class Subscriber(Base):
    __tablename__ = "subscribers"
    id: Mapped[int] = mapped_column(primary_key=True)
    group_name: Mapped[str | None] = mapped_column(String)
    customer: Mapped[str | None] = mapped_column(String)
    username: Mapped[str | None] = mapped_column(String)
    exp_date: Mapped[str | None] = mapped_column(String)
    wakil: Mapped[str | None] = mapped_column(String)
    status: Mapped[str | None] = mapped_column(String)
    note: Mapped[str | None] = mapped_column(String)
