"""Add post category and is_urgent fields

Revision ID: 008_add_post_category_and_urgent
Revises: 007_add_notifications_table
Create Date: 2025-01-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '008_add_post_category_and_urgent'
down_revision = '007_add_notifications_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create PostCategory enum
    op.execute("""
        CREATE TYPE postcategory AS ENUM (
            'GENERAL',
            'HELP',
            'LOST_FOUND',
            'EVENT',
            'MARKETPLACE',
            'ANNOUNCEMENT',
            'ALERT',
            'DISCUSSION'
        )
    """)
    
    # Add category column with default
    op.add_column('posts', sa.Column('category', postgresql.ENUM('GENERAL', 'HELP', 'LOST_FOUND', 'EVENT', 'MARKETPLACE', 'ANNOUNCEMENT', 'ALERT', 'DISCUSSION', name='postcategory'), nullable=False, server_default='GENERAL'))
    
    # Add is_urgent column with default
    op.add_column('posts', sa.Column('is_urgent', sa.Boolean(), nullable=False, server_default='false'))
    
    # Create indexes for better query performance
    op.create_index('ix_posts_category', 'posts', ['category'])
    op.create_index('ix_posts_is_urgent', 'posts', ['is_urgent'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_posts_is_urgent', table_name='posts')
    op.drop_index('ix_posts_category', table_name='posts')
    
    # Drop columns
    op.drop_column('posts', 'is_urgent')
    op.drop_column('posts', 'category')
    
    # Drop enum type
    op.execute("DROP TYPE postcategory")

