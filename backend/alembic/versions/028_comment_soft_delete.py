"""add comment soft deletion

Revision ID: 028
Revises: 027
Create Date: 2026-07-13
"""

from alembic import op
import sqlalchemy as sa


revision = "028"
down_revision = "027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "comments",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_comments_deleted_at", "comments", ["deleted_at"])


def downgrade() -> None:
    op.drop_index("ix_comments_deleted_at", table_name="comments")
    op.drop_column("comments", "deleted_at")
