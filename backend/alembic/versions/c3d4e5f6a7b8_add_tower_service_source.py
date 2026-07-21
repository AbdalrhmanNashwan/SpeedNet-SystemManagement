"""add tower service-source fields (feed_model, fed_by, feed_port, feed_mode)

Where a tower gets its service from, as the four parts of a note like
"328-bpwatani452-eth5-tag": switch model / source switch / port / tag mode.
Used to trace outages to their upstream source. Additive, all nullable.
(VLAN is intentionally NOT here — the tower already has a `vlan` field.)

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
    for col in ("feed_model", "fed_by", "feed_port", "feed_mode"):
        op.add_column("towers", sa.Column(col, sa.String(), nullable=True))


def downgrade() -> None:
    for col in ("feed_mode", "feed_port", "fed_by", "feed_model"):
        op.drop_column("towers", col)
