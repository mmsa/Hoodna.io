"""add compound hero image url

Revision ID: 029
Revises: 028
Create Date: 2026-07-13
"""

from alembic import op
import sqlalchemy as sa


revision = "029"
down_revision = "028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "compounds",
        sa.Column("hero_image_url", sa.String(length=512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("compounds", "hero_image_url")
