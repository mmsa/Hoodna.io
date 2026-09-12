"""Add push_tokens table for device push notification delivery.

Revision ID: 045
Revises: 044
Create Date: 2026-09-12
"""
import sqlalchemy as sa
from alembic import op

revision = "045"
down_revision = "044"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "push_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token", sa.String(length=255), nullable=False),
        sa.Column("platform", sa.String(length=16), nullable=True),
        sa.Column("device_name", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_push_tokens_id", "push_tokens", ["id"])
    op.create_index("ix_push_tokens_user_id", "push_tokens", ["user_id"])
    # Unique so re-registering the same device updates the owner instead of
    # creating duplicates, which would send every alert twice.
    op.create_index("ix_push_tokens_token", "push_tokens", ["token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_push_tokens_token", table_name="push_tokens")
    op.drop_index("ix_push_tokens_user_id", table_name="push_tokens")
    op.drop_index("ix_push_tokens_id", table_name="push_tokens")
    op.drop_table("push_tokens")
