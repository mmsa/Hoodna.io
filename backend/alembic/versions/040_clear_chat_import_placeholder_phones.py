"""Clear fake 900… phones invented for name-only WhatsApp chat imports.

Revision ID: 040_clear_chat_import_placeholder_phones
Revises: 039_strip_import_provenance_footers
Create Date: 2026-08-25
"""

from alembic import op

revision = "040_clear_chat_import_placeholder_phones"
down_revision = "039_strip_import_provenance_footers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Synthetic phones were "900" + 9 digits — not dialable, but looked real in admin
    # and could confuse OTP. Clear them for chat-import users only.
    op.execute(
        """
        UPDATE users
        SET phone = NULL
        WHERE creation_source = 'CHAT_IMPORT'
          AND phone IS NOT NULL
          AND phone LIKE '900%'
          AND length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 12
        """
    )


def downgrade() -> None:
    # Cannot restore discarded synthetic phones.
    pass
