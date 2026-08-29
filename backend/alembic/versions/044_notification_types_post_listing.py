"""Add NEW_POST and NEW_LISTING notification types.

Revision ID: 044
Revises: 043
Create Date: 2026-08-29
"""
from alembic import op

revision = "044"
down_revision = "043"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        for value in ("NEW_POST", "NEW_LISTING"):
            op.execute(
                f"ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS '{value}'"
            )


def downgrade() -> None:
    # PostgreSQL cannot easily drop enum values; leave them in place.
    pass
