"""Add compound moderator field

Revision ID: 006_add_compound_moderator
Revises: 005_add_messaging_tables
Create Date: 2024-01-16 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "006_add_compound_moderator"
down_revision = "005_add_messaging_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add moderator_id column to compounds table
    op.add_column(
        "compounds",
        sa.Column("moderator_id", sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        "fk_compounds_moderator_id",
        "compounds",
        "users",
        ["moderator_id"],
        ["id"]
    )
    op.create_index(
        "ix_compounds_moderator_id",
        "compounds",
        ["moderator_id"],
        unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_compounds_moderator_id", table_name="compounds")
    op.drop_constraint("fk_compounds_moderator_id", "compounds", type_="foreignkey")
    op.drop_column("compounds", "moderator_id")

