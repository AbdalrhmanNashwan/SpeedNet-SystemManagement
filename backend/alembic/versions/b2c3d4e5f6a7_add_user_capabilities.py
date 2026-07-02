"""add users.can_create/can_update/can_delete (granular write capabilities)

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-01
"""
from alembic import op
import sqlalchemy as sa

revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for col in ("can_create", "can_update", "can_delete"):
        op.add_column(
            "users",
            sa.Column(col, sa.Boolean(), nullable=False, server_default="false"),
        )
    # Backfill so existing accounts keep the access they had before this change:
    #   * editors could add/edit/delete everything  -> all three
    #   * agents could add/edit/delete within zone   -> all three
    #   * viewers were read-only                      -> none (defaults)
    #   * admins are all-powerful regardless of flags -> leave as-is
    op.execute(
        "UPDATE users SET can_create = true, can_update = true, can_delete = true "
        "WHERE role IN ('editor', 'agent')"
    )


def downgrade() -> None:
    for col in ("can_delete", "can_update", "can_create"):
        op.drop_column("users", col)
