"""add notifications table

Revision ID: 007_add_notifications_table
Revises: 006_add_compound_moderator
Create Date: 2025-12-28 21:15:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '007_add_notifications_table'
down_revision = '006_add_compound_moderator'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Reuse existing enum if present to avoid duplicate creation errors
    notification_enum = postgresql.ENUM(
        'MESSAGE',
        'COMMENT',
        'POST_LIKE',
        'VERIFICATION_APPROVED',
        'VERIFICATION_REJECTED',
        'VERIFICATION_REQUEST_MORE',
        'LISTING_INQUIRY',
        'LISTING_SAVED',
        'MENTION',
        name='notificationtype',
        create_type=False,
    )

    # Create NotificationType enum if it does not already exist (handles reruns/partial failures)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notificationtype') THEN
                CREATE TYPE notificationtype AS ENUM (
                    'MESSAGE',
                    'COMMENT',
                    'POST_LIKE',
                    'VERIFICATION_APPROVED',
                    'VERIFICATION_REJECTED',
                    'VERIFICATION_REQUEST_MORE',
                    'LISTING_INQUIRY',
                    'LISTING_SAVED',
                    'MENTION'
                );
            END IF;
        END$$;
    """)
    
    # Create notifications table
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('type', notification_enum, nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('read', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('related_id', sa.Integer(), nullable=True),
        sa.Column('related_type', sa.String(), nullable=True),
        sa.Column('extra_data', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index(op.f('ix_notifications_user_id'), 'notifications', ['user_id'], unique=False)
    op.create_index(op.f('ix_notifications_read'), 'notifications', ['read'], unique=False)
    op.create_index(op.f('ix_notifications_created_at'), 'notifications', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_notifications_created_at'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_read'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_user_id'), table_name='notifications')
    op.drop_table('notifications')
    op.execute("DROP TYPE IF EXISTS notificationtype")
