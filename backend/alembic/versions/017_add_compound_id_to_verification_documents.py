"""add compound_id to verification_documents

Revision ID: 017
Revises: 016
Create Date: 2026-07-12

"""
from alembic import op
import sqlalchemy as sa


revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "verification_documents",
        sa.Column("compound_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_verification_documents_compound_id",
        "verification_documents",
        "compounds",
        ["compound_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "ix_verification_documents_compound_id",
        "verification_documents",
        ["compound_id"],
    )

    # Backfill: single verified membership per user
    op.execute(
        """
        UPDATE verification_documents vd
        SET compound_id = sub.compound_id
        FROM (
            SELECT user_id, MIN(compound_id) AS compound_id
            FROM user_compound_memberships
            GROUP BY user_id
            HAVING COUNT(*) = 1
        ) sub
        WHERE vd.user_id = sub.user_id AND vd.compound_id IS NULL
        """
    )

    # Fallback: user's active compound
    op.execute(
        """
        UPDATE verification_documents vd
        SET compound_id = u.compound_id
        FROM users u
        WHERE vd.user_id = u.id
          AND vd.compound_id IS NULL
          AND u.compound_id IS NOT NULL
        """
    )

    op.create_unique_constraint(
        "uq_verification_documents_user_compound_type",
        "verification_documents",
        ["user_id", "compound_id", "type"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_verification_documents_user_compound_type",
        "verification_documents",
        type_="unique",
    )
    op.drop_index("ix_verification_documents_compound_id", table_name="verification_documents")
    op.drop_constraint(
        "fk_verification_documents_compound_id",
        "verification_documents",
        type_="foreignkey",
    )
    op.drop_column("verification_documents", "compound_id")
