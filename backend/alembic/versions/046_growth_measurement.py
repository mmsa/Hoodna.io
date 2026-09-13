"""add growth measurement columns

Revision ID: 046
Revises: 045
Create Date: 2026-09-13
"""
import sqlalchemy as sa
from alembic import op

revision = "046"
down_revision = "045"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("attribution", sa.JSON(), nullable=True))
    op.add_column(
        "users",
        sa.Column("registration_platform", sa.String(length=16), nullable=True),
    )
    op.add_column("users", sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_users_registration_platform", "users", ["registration_platform"])
    op.create_index("ix_users_verified_at", "users", ["verified_at"])
    op.create_index("ix_users_activated_at", "users", ["activated_at"])
    op.add_column(
        "user_compound_memberships",
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_compound_memberships", "verified_at")
    op.drop_index("ix_users_activated_at", table_name="users")
    op.drop_index("ix_users_verified_at", table_name="users")
    op.drop_index("ix_users_registration_platform", table_name="users")
    op.drop_column("users", "activated_at")
    op.drop_column("users", "verified_at")
    op.drop_column("users", "registration_platform")
    op.drop_column("users", "attribution")
