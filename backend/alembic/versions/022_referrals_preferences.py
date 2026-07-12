"""add referrals, user preferences, and account deletion requests

Revision ID: 022
Revises: 021
Create Date: 2026-07-12
"""
from alembic import op
import sqlalchemy as sa


revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None


def enum(*values, name):
    return sa.Enum(*values, name=name, native_enum=False, create_constraint=True)


def upgrade() -> None:
    op.create_table(
        "referral_invites",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("inviter_id", sa.Integer(), nullable=True),
        sa.Column("accepted_user_id", sa.Integer(), nullable=True),
        sa.Column("invited_email", sa.String(length=320), nullable=True),
        sa.Column("invited_phone", sa.String(length=32), nullable=True),
        sa.Column(
            "status",
            enum("PENDING", "ACCEPTED", "EXPIRED", "CANCELLED", name="referral_invite_status"),
            server_default="PENDING",
            nullable=False,
        ),
        sa.Column(
            "reward_status",
            enum(
                "NOT_ELIGIBLE", "PENDING", "EARNED", "PAID", "VOIDED",
                name="referral_reward_status",
            ),
            server_default="NOT_ELIGIBLE",
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["accepted_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["inviter_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("accepted_user_id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index("ix_referral_invites_id", "referral_invites", ["id"])
    for column in ("code", "inviter_id", "accepted_user_id", "invited_email", "status", "reward_status", "created_at"):
        op.create_index(f"ix_referral_invites_{column}", "referral_invites", [column])

    op.create_table(
        "user_preferences",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("email_notifications", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("push_notifications", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("community_notifications", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("marketplace_notifications", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("digest_enabled", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column(
            "digest_frequency",
            enum("DAILY", "WEEKLY", name="digest_frequency"),
            server_default="WEEKLY",
            nullable=False,
        ),
        sa.Column("preferences", sa.JSON(), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_user_preferences_id", "user_preferences", ["id"])
    op.create_index("ix_user_preferences_user_id", "user_preferences", ["user_id"])

    op.create_table(
        "account_deletion_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column(
            "status",
            enum("PENDING", "CANCELLED", "COMPLETED", "REJECTED", name="account_deletion_status"),
            server_default="PENDING",
            nullable=False,
        ),
        sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewer_id", sa.Integer(), nullable=True),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["reviewer_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_account_deletion_requests_id", "account_deletion_requests", ["id"])
    op.create_index("ix_account_deletion_requests_user_id", "account_deletion_requests", ["user_id"])
    op.create_index("ix_account_deletion_requests_status", "account_deletion_requests", ["status"])
    op.create_index("ix_account_deletion_requests_requested_at", "account_deletion_requests", ["requested_at"])


def downgrade() -> None:
    op.drop_table("account_deletion_requests")
    op.drop_table("user_preferences")
    op.drop_table("referral_invites")
