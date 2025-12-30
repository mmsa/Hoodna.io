"""Add saved_posts table

Revision ID: 009_add_saved_posts_table
Revises: 008_add_post_category_and_urgent
Create Date: 2025-01-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '009_add_saved_posts_table'
down_revision = '008_add_post_category_and_urgent'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create saved_posts table
    op.create_table(
        'saved_posts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('post_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'post_id', name='uq_user_post')
    )
    op.create_index(op.f('ix_saved_posts_id'), 'saved_posts', ['id'], unique=False)
    op.create_index('ix_saved_posts_user_id', 'saved_posts', ['user_id'], unique=False)
    op.create_index('ix_saved_posts_post_id', 'saved_posts', ['post_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_saved_posts_post_id', table_name='saved_posts')
    op.drop_index('ix_saved_posts_user_id', table_name='saved_posts')
    op.drop_index(op.f('ix_saved_posts_id'), table_name='saved_posts')
    op.drop_table('saved_posts')

