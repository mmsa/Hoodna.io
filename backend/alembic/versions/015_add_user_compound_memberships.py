"""add user compound memberships table

Revision ID: 015
Revises: 014
Create Date: 2026-05-19

"""
from alembic import op
import sqlalchemy as sa


revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_compound_memberships",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("compound_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["compound_id"], ["compounds.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "compound_id", name="uq_user_compound_membership"),
    )
    op.create_index(
        "ix_user_compound_memberships_user_id",
        "user_compound_memberships",
        ["user_id"],
    )
    op.create_index(
        "ix_user_compound_memberships_compound_id",
        "user_compound_memberships",
        ["compound_id"],
    )

    # Backfill: approved residents with an active compound
    op.execute(
        """
        INSERT INTO user_compound_memberships (user_id, compound_id)
        SELECT id, compound_id
        FROM users
        WHERE compound_id IS NOT NULL
          AND status = 'APPROVED'
        ON CONFLICT (user_id, compound_id) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index("ix_user_compound_memberships_compound_id", table_name="user_compound_memberships")
    op.drop_index("ix_user_compound_memberships_user_id", table_name="user_compound_memberships")
    op.drop_table("user_compound_memberships")
