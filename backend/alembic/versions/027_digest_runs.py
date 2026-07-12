"""add digest runs and deliveries

Revision ID: 027
Revises: 026
Create Date: 2026-07-12
"""
from alembic import op
import sqlalchemy as sa


revision = "027"
down_revision = "026"
branch_labels = None
depends_on = None


def enum(*values, name):
    return sa.Enum(*values, name=name, native_enum=False, create_constraint=True)


def upgrade() -> None:
    # ``notifications.type`` is a native PostgreSQL enum created in migration 007.
    if op.get_bind().dialect.name == "postgresql":
        for value in (
            "WEEKLY_DIGEST",
            "BUSINESS_CLAIM_SUBMITTED",
            "BUSINESS_CLAIM_APPROVED",
            "BUSINESS_CLAIM_REJECTED",
            "REFERRAL_ACCEPTED",
            "REPORT_STATUS_UPDATED",
        ):
            op.execute(
                f"ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS '{value}'"
            )

    op.create_table(
        "digest_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("idempotency_key", sa.String(length=200), nullable=False),
        sa.Column("frequency", enum("DAILY", "WEEKLY", name="digest_frequency"), nullable=False),
        sa.Column("compound_id", sa.Integer(), nullable=True),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status",
            enum("PENDING", "RUNNING", "COMPLETED", "FAILED", name="digest_run_status"),
            server_default="PENDING",
            nullable=False,
        ),
        sa.Column("stats", sa.JSON(), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["compound_id"], ["compounds.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key"),
        sa.UniqueConstraint(
            "frequency", "period_start", "period_end", "compound_id",
            name="uq_digest_run_period_compound",
        ),
    )
    op.create_index("ix_digest_runs_id", "digest_runs", ["id"])
    op.create_index("ix_digest_runs_idempotency_key", "digest_runs", ["idempotency_key"])
    op.create_index("ix_digest_runs_frequency", "digest_runs", ["frequency"])
    op.create_index("ix_digest_runs_compound_id", "digest_runs", ["compound_id"])
    op.create_index("ix_digest_runs_status", "digest_runs", ["status"])
    op.create_index("ix_digest_runs_status_started", "digest_runs", ["status", "started_at"])

    op.create_table(
        "digest_deliveries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("digest_run_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "channel",
            enum("EMAIL", "PUSH", "IN_APP", name="digest_channel"),
            nullable=False,
        ),
        sa.Column("recipient", sa.String(length=320), nullable=True),
        sa.Column(
            "status",
            enum("PENDING", "SENT", "FAILED", "SKIPPED", name="digest_delivery_status"),
            server_default="PENDING",
            nullable=False,
        ),
        sa.Column("content_summary", sa.JSON(), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("provider_message_id", sa.String(length=200), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["digest_run_id"], ["digest_runs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "digest_run_id", "user_id", "channel",
            name="uq_digest_delivery_run_user_channel",
        ),
    )
    op.create_index("ix_digest_deliveries_id", "digest_deliveries", ["id"])
    for column in ("digest_run_id", "user_id", "channel", "status", "provider_message_id"):
        op.create_index(f"ix_digest_deliveries_{column}", "digest_deliveries", [column])
    op.create_index(
        "ix_digest_deliveries_status_created",
        "digest_deliveries",
        ["status", "created_at"],
    )


def downgrade() -> None:
    op.drop_table("digest_deliveries")
    op.drop_table("digest_runs")
