"""Clear invalid chat-import provenance from listing.attributes

Revision ID: 037
Revises: 036
Create Date: 2026-08-24
"""

from alembic import op

revision = "037"
down_revision = "036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Chat import stored provenance keys that are not valid category attributes
    # and caused ListingResponse ValidationError (500) on GET /api/listings.
    op.execute(
        """
        UPDATE listings
        SET attributes = NULL
        WHERE attributes IS NOT NULL
          AND (
            attributes ? 'imported_from'
            OR attributes ? 'chat_import_job_id'
            OR attributes ? 'original_timestamp'
          )
        """
    )


def downgrade() -> None:
    # Irreversible data cleanup
    pass
