"""add outage_events (durable outage history for uptime reporting)

The live monitor is in-memory only, so every restart erased the record of what
had been down. This table persists one row per confirmed down->up cycle so
uptime / downtime can actually be reported over a period.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-07-24
"""
from alembic import op
import sqlalchemy as sa

revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "outage_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ip", sa.String(), nullable=False),
        # SET NULL, not CASCADE: deleting a tower must not erase the history of
        # the outages it had.
        sa.Column("tower_id", sa.Integer(),
                  sa.ForeignKey("towers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("tower_name", sa.String(), nullable=True),
        sa.Column("label", sa.String(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_outage_events_ip", "outage_events", ["ip"])
    op.create_index("ix_outage_events_tower_id", "outage_events", ["tower_id"])
    op.create_index("ix_outage_events_started_at", "outage_events", ["started_at"])
    op.create_index("ix_outage_events_ip_open", "outage_events", ["ip", "ended_at"])
    op.create_index("ix_outage_events_started_ended", "outage_events",
                    ["started_at", "ended_at"])


def downgrade() -> None:
    op.drop_index("ix_outage_events_started_ended", table_name="outage_events")
    op.drop_index("ix_outage_events_ip_open", table_name="outage_events")
    op.drop_index("ix_outage_events_started_at", table_name="outage_events")
    op.drop_index("ix_outage_events_tower_id", table_name="outage_events")
    op.drop_index("ix_outage_events_ip", table_name="outage_events")
    op.drop_table("outage_events")
