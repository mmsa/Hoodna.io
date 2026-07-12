"""add verification status to compound memberships

Revision ID: 019
Revises: 018
Create Date: 2026-07-12

"""
from alembic import op
import sqlalchemy as sa


revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_compound_memberships",
        sa.Column(
            "verification_status",
            sa.String(),
            nullable=False,
            server_default="PENDING",
        ),
    )
    op.add_column(
        "user_compound_memberships",
        sa.Column("verification_source", sa.String(), nullable=True),
    )
    op.create_index(
        "ix_user_compound_memberships_verification_status",
        "user_compound_memberships",
        ["verification_status"],
    )

    # Only approved compound-scoped documents prove historical verification.
    # Rows created merely by switching compounds remain PENDING.
    op.execute(
        """
        UPDATE user_compound_memberships ucm
        SET verification_status = 'VERIFIED',
            verification_source = 'DOCUMENT'
        WHERE EXISTS (
            SELECT 1
            FROM verification_documents vd
            WHERE vd.user_id = ucm.user_id
              AND vd.compound_id = ucm.compound_id
              AND vd.status = 'APPROVED'
        )
        """
    )

    op.alter_column(
        "user_compound_memberships",
        "verification_status",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_user_compound_memberships_verification_status",
        table_name="user_compound_memberships",
    )
    op.drop_column("user_compound_memberships", "verification_source")
    op.drop_column("user_compound_memberships", "verification_status")
