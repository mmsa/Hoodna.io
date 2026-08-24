"""Add COMMENT kind to chat import items

Revision ID: 036
Revises: 035
Create Date: 2026-08-24
"""

from alembic import op


revision = "036"
down_revision = "035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # native_enum=False → CHECK constraint named after the enum
    op.execute("ALTER TABLE chat_import_items DROP CONSTRAINT IF EXISTS chat_import_item_kind")
    op.execute(
        """
        ALTER TABLE chat_import_items
        ADD CONSTRAINT chat_import_item_kind
        CHECK (kind IN ('USER', 'POST', 'LISTING', 'SKIP', 'COMMENT'))
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE chat_import_items DROP CONSTRAINT IF EXISTS chat_import_item_kind")
    op.execute(
        """
        ALTER TABLE chat_import_items
        ADD CONSTRAINT chat_import_item_kind
        CHECK (kind IN ('USER', 'POST', 'LISTING', 'SKIP'))
        """
    )
