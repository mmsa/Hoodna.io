"""add chat import jobs and items

Revision ID: 034
Revises: 033
Create Date: 2026-08-24
"""

from alembic import op
import sqlalchemy as sa


revision = "034"
down_revision = "033"
branch_labels = None
depends_on = None


def enum(*values, name):
    return sa.Enum(*values, name=name, native_enum=False, create_constraint=True)


def upgrade() -> None:
    op.create_table(
        "chat_import_jobs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("compound_id", sa.Integer(), nullable=False),
        sa.Column("uploaded_by_id", sa.Integer(), nullable=True),
        sa.Column(
            "source",
            enum("WHATSAPP", "TELEGRAM", name="chat_import_source"),
            nullable=False,
        ),
        sa.Column(
            "status",
            enum(
                "UPLOADED",
                "PARSING",
                "PREVIEW",
                "PUBLISHING",
                "COMPLETED",
                "FAILED",
                name="chat_import_job_status",
            ),
            server_default="UPLOADED",
            nullable=False,
        ),
        sa.Column("original_filename", sa.String(length=500), nullable=True),
        sa.Column("storage_path", sa.String(length=1000), nullable=True),
        sa.Column("stats", sa.JSON(), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["compound_id"], ["compounds.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chat_import_jobs_id", "chat_import_jobs", ["id"])
    op.create_index("ix_chat_import_jobs_compound_id", "chat_import_jobs", ["compound_id"])
    op.create_index("ix_chat_import_jobs_uploaded_by_id", "chat_import_jobs", ["uploaded_by_id"])
    op.create_index("ix_chat_import_jobs_source", "chat_import_jobs", ["source"])
    op.create_index("ix_chat_import_jobs_status", "chat_import_jobs", ["status"])
    op.create_index(
        "ix_chat_import_jobs_compound_status",
        "chat_import_jobs",
        ["compound_id", "status"],
    )

    op.create_table(
        "chat_import_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column(
            "kind",
            enum("USER", "POST", "LISTING", "SKIP", name="chat_import_item_kind"),
            nullable=False,
        ),
        sa.Column(
            "decision",
            enum(
                "PENDING",
                "APPROVED",
                "REJECTED",
                name="chat_import_item_decision",
            ),
            server_default="PENDING",
            nullable=False,
        ),
        sa.Column("raw_payload", sa.JSON(), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("normalized", sa.JSON(), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("matched_user_id", sa.Integer(), nullable=True),
        sa.Column("published_entity_type", sa.String(length=50), nullable=True),
        sa.Column("published_entity_id", sa.Integer(), nullable=True),
        sa.Column("reject_reason", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["job_id"], ["chat_import_jobs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["matched_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chat_import_items_id", "chat_import_items", ["id"])
    op.create_index("ix_chat_import_items_job_id", "chat_import_items", ["job_id"])
    op.create_index("ix_chat_import_items_kind", "chat_import_items", ["kind"])
    op.create_index("ix_chat_import_items_decision", "chat_import_items", ["decision"])
    op.create_index(
        "ix_chat_import_items_matched_user_id",
        "chat_import_items",
        ["matched_user_id"],
    )
    op.create_index(
        "ix_chat_import_items_job_decision",
        "chat_import_items",
        ["job_id", "decision"],
    )
    op.create_index(
        "ix_chat_import_items_job_kind",
        "chat_import_items",
        ["job_id", "kind"],
    )


def downgrade() -> None:
    op.drop_table("chat_import_items")
    op.drop_table("chat_import_jobs")
