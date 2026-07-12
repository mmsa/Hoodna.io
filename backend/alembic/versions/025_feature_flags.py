"""add feature flags and scoped overrides

Revision ID: 025
Revises: 024
Create Date: 2026-07-12
"""
from alembic import op
import sqlalchemy as sa


revision = "025"
down_revision = "024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "feature_flags",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("enabled", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("config", sa.JSON(), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )
    op.create_index("ix_feature_flags_id", "feature_flags", ["id"])
    op.create_index("ix_feature_flags_key", "feature_flags", ["key"])
    op.create_index("ix_feature_flags_enabled", "feature_flags", ["enabled"])

    op.create_table(
        "feature_flag_overrides",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("feature_flag_id", sa.Integer(), nullable=False),
        sa.Column(
            "scope",
            sa.Enum(
                "USER", "COMPOUND", "CITY",
                name="feature_flag_scope",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("target_key", sa.String(length=160), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("compound_id", sa.Integer(), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("config", sa.JSON(), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "(scope = 'USER' AND user_id IS NOT NULL AND compound_id IS NULL AND city IS NULL) "
            "OR (scope = 'COMPOUND' AND user_id IS NULL AND compound_id IS NOT NULL AND city IS NULL) "
            "OR (scope = 'CITY' AND user_id IS NULL AND compound_id IS NULL AND city IS NOT NULL)",
            name="ck_feature_flag_override_scope_target",
        ),
        sa.ForeignKeyConstraint(["compound_id"], ["compounds.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["feature_flag_id"], ["feature_flags.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "feature_flag_id", "scope", "target_key",
            name="uq_feature_flag_override_target",
        ),
    )
    op.create_index("ix_feature_flag_overrides_id", "feature_flag_overrides", ["id"])
    for column in ("feature_flag_id", "scope", "user_id", "compound_id", "city"):
        op.create_index(f"ix_feature_flag_overrides_{column}", "feature_flag_overrides", [column])
    op.create_index(
        "ix_feature_flag_overrides_lookup",
        "feature_flag_overrides",
        ["scope", "target_key"],
    )


def downgrade() -> None:
    op.drop_table("feature_flag_overrides")
    op.drop_table("feature_flags")
