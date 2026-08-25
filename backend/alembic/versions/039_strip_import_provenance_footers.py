"""strip chat-import provenance footer from posts/comments

Revision ID: 039
Revises: 038
Create Date: 2026-08-25
"""

from alembic import op


revision = "039"
down_revision = "038"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove "— imported from group chat (job #N)" footers from already-published content.
    op.execute(
        r"""
        UPDATE posts
        SET content = regexp_replace(
            content,
            E'\\s*—\\s*imported from group chat \\(job #[0-9]+\\)\\s*$',
            '',
            'g'
        )
        WHERE content ~ E'imported from group chat \\(job #[0-9]+\\)'
        """
    )
    op.execute(
        r"""
        UPDATE comments
        SET content = regexp_replace(
            content,
            E'\\s*—\\s*imported from group chat \\(job #[0-9]+\\)\\s*$',
            '',
            'g'
        )
        WHERE content ~ E'imported from group chat \\(job #[0-9]+\\)'
        """
    )


def downgrade() -> None:
    # Irreversible content cleanup
    pass
