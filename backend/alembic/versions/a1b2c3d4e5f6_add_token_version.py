"""add users.token_version (JWT revocation)

Revision ID: a1b2c3d4e5f6
Revises: 8caa39b31f3b
Create Date: 2026-06-29
"""
from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f6"
down_revision = "8caa39b31f3b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("users", "token_version")
