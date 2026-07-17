"""add service category updated_at

Revision ID: 031
Revises: 030
Create Date: 2026-07-17
"""

from alembic import op


revision = "031"
down_revision = "030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE service_categories
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE service_categories
        DROP COLUMN IF EXISTS updated_at
        """
    )
