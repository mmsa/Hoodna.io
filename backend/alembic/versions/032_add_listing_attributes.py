"""add listing attributes

Revision ID: 032
Revises: 031
Create Date: 2026-07-17
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "032"
down_revision = "031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "listings",
        sa.Column("attributes", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("listings", "attributes")
