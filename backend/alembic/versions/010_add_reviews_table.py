"""add reviews table

Revision ID: 010
Revises: 009
Create Date: 2024-12-30 17:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import func


# revision identifiers, used by Alembic.
revision: str = '010'
down_revision: str | None = '009'
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    # Create reviews table
    op.create_table(
        'reviews',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('listing_id', sa.Integer(), sa.ForeignKey('listings.id'), nullable=False),
        sa.Column('reviewer_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('rating', sa.Numeric(2, 1), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('rating >= 1.0 AND rating <= 5.0', name='check_rating_range'),
        sa.UniqueConstraint('listing_id', 'reviewer_id', name='uq_listing_reviewer')
    )
    op.create_index('ix_reviews_id', 'reviews', ['id'], unique=False)
    op.create_index('ix_reviews_listing_id', 'reviews', ['listing_id'], unique=False)
    op.create_index('ix_reviews_reviewer_id', 'reviews', ['reviewer_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_reviews_reviewer_id', table_name='reviews')
    op.drop_index('ix_reviews_listing_id', table_name='reviews')
    op.drop_index('ix_reviews_id', table_name='reviews')
    op.drop_table('reviews')

