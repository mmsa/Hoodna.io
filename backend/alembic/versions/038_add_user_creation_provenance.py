"""add user creation provenance fields

Revision ID: 038
Revises: 037
Create Date: 2026-08-25
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "038"
down_revision = "037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("creation_source", sa.String(length=64), nullable=True, index=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "creation_details",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "creation_job_id",
            sa.Integer(),
            sa.ForeignKey("chat_import_jobs.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_users_creation_job_id", "users", ["creation_job_id"])

    # Demo accounts
    op.execute(
        """
        UPDATE users
        SET creation_source = 'DEMO',
            creation_details = COALESCE(creation_details, '{}'::jsonb) ||
              jsonb_build_object('note', 'Demo seed account')
        WHERE creation_source IS NULL
          AND email ILIKE '%.demo.hoodna.local'
        """
    )

    # Chat-import memberships
    op.execute(
        """
        UPDATE users u
        SET creation_source = 'CHAT_IMPORT'
        WHERE u.creation_source IS NULL
          AND EXISTS (
            SELECT 1 FROM user_compound_memberships m
            WHERE m.user_id = u.id
              AND m.verification_source = 'CHAT_IMPORT'
          )
        """
    )

    # Enrich chat-import users from earliest matched job
    op.execute(
        """
        UPDATE users u
        SET creation_job_id = sub.job_id,
            creation_details = COALESCE(u.creation_details, '{}'::jsonb) ||
              jsonb_build_object(
                'original_filename', sub.original_filename,
                'chat_source', sub.chat_source,
                'imported_at', sub.job_created_at
              )
        FROM (
            SELECT DISTINCT ON (ci.matched_user_id)
                ci.matched_user_id AS user_id,
                j.id AS job_id,
                j.original_filename,
                j.source::text AS chat_source,
                j.created_at::text AS job_created_at
            FROM chat_import_items ci
            JOIN chat_import_jobs j ON j.id = ci.job_id
            WHERE ci.matched_user_id IS NOT NULL
            ORDER BY ci.matched_user_id, j.created_at ASC, j.id ASC
        ) AS sub
        WHERE u.id = sub.user_id
          AND (u.creation_source = 'CHAT_IMPORT' OR u.creation_source IS NULL)
          AND u.creation_job_id IS NULL
        """
    )

    # Phone OTP / synthetic phone emails
    op.execute(
        """
        UPDATE users
        SET creation_source = 'PHONE_AUTH',
            creation_details = COALESCE(creation_details, '{}'::jsonb) ||
              jsonb_build_object('note', 'Registered with phone')
        WHERE creation_source IS NULL
          AND email ~ '^phone_.*@hoodna\\.local$'
        """
    )

    # Seeded admins
    op.execute(
        """
        UPDATE users
        SET creation_source = 'SEED_ADMIN',
            creation_details = COALESCE(creation_details, '{}'::jsonb) ||
              jsonb_build_object('note', 'Seeded admin account')
        WHERE creation_source IS NULL
          AND role = 'ADMIN'
        """
    )

    # Remaining email signups
    op.execute(
        """
        UPDATE users
        SET creation_source = 'EMAIL_SIGNUP',
            creation_details = COALESCE(creation_details, '{}'::jsonb) ||
              jsonb_build_object('note', 'Registered with email')
        WHERE creation_source IS NULL
        """
    )


def downgrade() -> None:
    op.drop_index("ix_users_creation_job_id", table_name="users")
    op.drop_column("users", "creation_job_id")
    op.drop_column("users", "creation_details")
    op.drop_column("users", "creation_source")
