"""Add missing userrole enum values (RESIDENT, SERVICE_PROVIDER, COMPOUND_MOD)

Revision ID: 016
Revises: 015
Create Date: 2026-07-11
"""
from typing import Sequence, Union

from alembic import op


revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ADD VALUE cannot run inside a transaction on PostgreSQL.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'RESIDENT'")
        op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'SERVICE_PROVIDER'")
        op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'COMPOUND_MOD'")


def downgrade() -> None:
    # Postgres cannot easily remove enum values; leave as no-op.
    pass
