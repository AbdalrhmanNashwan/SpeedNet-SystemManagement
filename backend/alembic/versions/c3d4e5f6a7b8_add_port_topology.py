"""add port topology: bridges, ports, port_vlans, connections, vlans, agencies

Structured replacement for free-text tower notes describing which port goes
where on which VLAN. Mirrors the RouterOS/Winbox model. Additive — nothing
existing is dropped; backbone_feeds is superseded but retained until its data
is migrated. See docs/design/PORT_TOPOLOGY.md.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-18
"""
from alembic import op
import sqlalchemy as sa

revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vlans",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("vlan_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String()),
        sa.Column("note", sa.String()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "bridges",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("tower_id", sa.BigInteger(), sa.ForeignKey("towers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("device_kind", sa.String()),
        sa.Column("device_id", sa.BigInteger()),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("vlan_filtering", sa.Boolean(), server_default="true"),
        sa.Column("protocol_mode", sa.String()),
        sa.Column("note", sa.String()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_bridges_tower", "bridges", ["tower_id"])

    op.create_table(
        "agencies",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("name", sa.String()),
        sa.Column("phone", sa.String()),
        sa.Column("vlan_id", sa.BigInteger(), sa.ForeignKey("vlans.id", ondelete="SET NULL")),
        sa.Column("home_tower_id", sa.BigInteger(), sa.ForeignKey("towers.id", ondelete="SET NULL")),
        sa.Column("status", sa.String(), server_default="Active"),
        sa.Column("note", sa.String()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_agencies_tower", "agencies", ["home_tower_id"])

    op.create_table(
        "ports",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("tower_id", sa.BigInteger(), sa.ForeignKey("towers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("bridge_id", sa.BigInteger(), sa.ForeignKey("bridges.id", ondelete="SET NULL")),
        sa.Column("device_kind", sa.String()),
        sa.Column("device_id", sa.BigInteger()),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("kind", sa.String()),
        sa.Column("role", sa.String()),
        sa.Column("pvid", sa.Integer()),
        sa.Column("note", sa.String()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_ports_tower", "ports", ["tower_id"])

    op.create_table(
        "port_vlans",
        sa.Column("port_id", sa.BigInteger(), sa.ForeignKey("ports.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("vlan_id", sa.BigInteger(), sa.ForeignKey("vlans.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tagged", sa.Boolean(), server_default="true"),
    )

    op.create_table(
        "connections",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("a_port_id", sa.BigInteger(), sa.ForeignKey("ports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("b_port_id", sa.BigInteger(), sa.ForeignKey("ports.id", ondelete="SET NULL")),
        sa.Column("agency_id", sa.BigInteger(), sa.ForeignKey("agencies.id", ondelete="SET NULL")),
        sa.Column("medium", sa.String()),
        sa.Column("note", sa.String()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_conn_a", "connections", ["a_port_id"])
    op.create_index("idx_conn_b", "connections", ["b_port_id"])


def downgrade() -> None:
    op.drop_table("connections")
    op.drop_table("port_vlans")
    op.drop_index("idx_ports_tower", table_name="ports")
    op.drop_table("ports")
    op.drop_index("idx_agencies_tower", table_name="agencies")
    op.drop_table("agencies")
    op.drop_index("idx_bridges_tower", table_name="bridges")
    op.drop_table("bridges")
    op.drop_table("vlans")
