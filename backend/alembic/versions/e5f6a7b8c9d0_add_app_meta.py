"""add app_meta (durable app facts, e.g. monitoring_since for uptime math)

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-07-24
"""
from alembic import op
import sqlalchemy as sa

revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "app_meta",
        sa.Column("key", sa.String(), primary_key=True),
        sa.Column("value", sa.String(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    # Seed monitoring_since from the earliest outage we've already recorded, so
    # a DB that's been collecting data keeps that observed window. Falls back to
    # now() on a fresh install with no history yet.
    op.execute(
        "INSERT INTO app_meta (key, value) SELECT 'monitoring_since', "
        "to_char(COALESCE(min(started_at), now()) at time zone 'utc', "
        "'YYYY-MM-DD\"T\"HH24:MI:SS.US\"+00:00\"') FROM outage_events"
    )


def downgrade() -> None:
    op.drop_table("app_meta")
