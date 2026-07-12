"""add post reactions

Revision ID: 020
Revises: 019
Create Date: 2026-07-12

"""
from alembic import op
import sqlalchemy as sa


revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "post_reactions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("post_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("reaction", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["post_id"], ["posts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("post_id", "user_id", name="uq_post_reaction_user"),
    )
    op.create_index("ix_post_reactions_id", "post_reactions", ["id"])
    op.create_index("ix_post_reactions_post_id", "post_reactions", ["post_id"])
    op.create_index("ix_post_reactions_user_id", "post_reactions", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_post_reactions_user_id", table_name="post_reactions")
    op.drop_index("ix_post_reactions_post_id", table_name="post_reactions")
    op.drop_index("ix_post_reactions_id", table_name="post_reactions")
    op.drop_table("post_reactions")
