"""Add imported content keep/discard choice for chat-import users.

Revision ID: 042
Revises: 041
Create Date: 2026-08-26
"""

from alembic import op
import sqlalchemy as sa

revision = "042"
down_revision = "041"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("imported_content_choice", sa.String(length=16), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "imported_content_choice_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "imported_content_choice_at")
    op.drop_column("users", "imported_content_choice")
