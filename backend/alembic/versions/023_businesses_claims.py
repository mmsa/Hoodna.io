"""add independent businesses, claims, and memberships

Revision ID: 023
Revises: 022
Create Date: 2026-07-12
"""
from alembic import op
import sqlalchemy as sa


revision = "023"
down_revision = "022"
branch_labels = None
depends_on = None


def enum(*values, name):
    return sa.Enum(*values, name=name, native_enum=False, create_constraint=True)


def upgrade() -> None:
    op.create_table(
        "independent_businesses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(length=160), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("compound_id", sa.Integer(), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=False),
        sa.Column("area", sa.String(length=120), nullable=True),
        sa.Column("category", sa.String(length=120), nullable=False),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("whatsapp", sa.String(length=32), nullable=True),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("website", sa.String(length=500), nullable=True),
        sa.Column("contact_name", sa.String(length=200), nullable=True),
        sa.Column("hours", sa.JSON(), server_default=sa.text("'{}'"), nullable=False),
        sa.Column(
            "verification_status",
            enum("UNVERIFIED", "CLAIMED", "VERIFIED", name="business_verification_status"),
            server_default="UNVERIFIED",
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("is_hidden", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["compound_id"], ["compounds.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_independent_businesses_id", "independent_businesses", ["id"])
    for column in ("slug", "name", "compound_id", "city", "area", "category", "verification_status", "is_active", "is_hidden", "created_at"):
        op.create_index(f"ix_independent_businesses_{column}", "independent_businesses", [column])
    op.create_index("ix_independent_businesses_location", "independent_businesses", ["city", "area"])
    op.create_index(
        "ix_independent_businesses_visibility",
        "independent_businesses",
        ["is_active", "is_hidden", "verification_status"],
    )

    op.create_table(
        "business_claims",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("claimant_id", sa.Integer(), nullable=True),
        sa.Column("full_name", sa.String(length=200), nullable=False),
        sa.Column("relationship_role", sa.String(length=120), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("supporting_info", sa.Text(), nullable=True),
        sa.Column("supporting_documents", sa.JSON(), server_default=sa.text("'[]'"), nullable=False),
        sa.Column(
            "status",
            enum("PENDING", "APPROVED", "REJECTED", name="business_claim_status"),
            server_default="PENDING",
            nullable=False,
        ),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewer_id", sa.Integer(), nullable=True),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["business_id"], ["independent_businesses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["claimant_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["reviewer_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_business_claims_id", "business_claims", ["id"])
    for column in ("business_id", "claimant_id", "status", "submitted_at", "reviewer_id"):
        op.create_index(f"ix_business_claims_{column}", "business_claims", [column])
    op.create_index("ix_business_claims_queue", "business_claims", ["status", "submitted_at"])
    op.create_index(
        "uq_business_claims_active_user_business",
        "business_claims",
        ["business_id", "claimant_id"],
        unique=True,
        postgresql_where=sa.text("status = 'PENDING'"),
        sqlite_where=sa.text("status = 'PENDING'"),
    )

    op.create_table(
        "business_memberships",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "role",
            enum("OWNER", "MANAGER", name="business_membership_role"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["independent_businesses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("business_id", "user_id", name="uq_business_membership_business_user"),
    )
    op.create_index("ix_business_memberships_id", "business_memberships", ["id"])
    for column in ("business_id", "user_id", "role"):
        op.create_index(f"ix_business_memberships_{column}", "business_memberships", [column])


def downgrade() -> None:
    op.drop_table("business_memberships")
    op.drop_table("business_claims")
    op.drop_table("independent_businesses")
