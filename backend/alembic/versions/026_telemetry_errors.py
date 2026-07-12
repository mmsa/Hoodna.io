"""add analytics events and client error reports

Revision ID: 026
Revises: 025
Create Date: 2026-07-12
"""
from alembic import op
import sqlalchemy as sa


revision = "026"
down_revision = "025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "analytics_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_name", sa.String(length=120), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("anonymous_id", sa.String(length=120), nullable=True),
        sa.Column("session_id", sa.String(length=120), nullable=True),
        sa.Column("platform", sa.String(length=40), nullable=True),
        sa.Column("app_version", sa.String(length=40), nullable=True),
        sa.Column("properties", sa.JSON(), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_analytics_events_id", "analytics_events", ["id"])
    for column in ("event_name", "user_id", "anonymous_id", "session_id", "occurred_at", "received_at"):
        op.create_index(f"ix_analytics_events_{column}", "analytics_events", [column])
    op.create_index("ix_analytics_events_name_occurred", "analytics_events", ["event_name", "occurred_at"])
    op.create_index("ix_analytics_events_user_occurred", "analytics_events", ["user_id", "occurred_at"])

    op.create_table(
        "client_error_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("fingerprint", sa.String(length=128), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("stack_trace", sa.Text(), nullable=True),
        sa.Column("source", sa.String(length=500), nullable=True),
        sa.Column("platform", sa.String(length=40), nullable=True),
        sa.Column("app_version", sa.String(length=40), nullable=True),
        sa.Column("severity", sa.String(length=20), server_default="ERROR", nullable=False),
        sa.Column("context", sa.JSON(), server_default=sa.text("'{}'"), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "OPEN", "RESOLVED", "IGNORED",
                name="client_error_status",
                native_enum=False,
                create_constraint=True,
            ),
            server_default="OPEN",
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["resolved_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_client_error_reports_id", "client_error_reports", ["id"])
    for column in ("user_id", "fingerprint", "severity", "status", "created_at"):
        op.create_index(f"ix_client_error_reports_{column}", "client_error_reports", [column])
    op.create_index(
        "ix_client_error_reports_fingerprint_created",
        "client_error_reports",
        ["fingerprint", "created_at"],
    )
    op.create_index(
        "ix_client_error_reports_status_created",
        "client_error_reports",
        ["status", "created_at"],
    )


def downgrade() -> None:
    op.drop_table("client_error_reports")
    op.drop_table("analytics_events")
