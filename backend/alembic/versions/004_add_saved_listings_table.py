"""Add saved_listings table

Revision ID: 004_add_saved_listings_table
Revises: 003_add_llm_verification_fields
Create Date: 2024-01-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '004_add_saved_listings_table'
down_revision = '003_add_llm_verification_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create saved_listings table
    op.create_table(
        'saved_listings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('listing_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['listing_id'], ['listings.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'listing_id', name='uq_user_listing')
    )
    op.create_index(op.f('ix_saved_listings_id'), 'saved_listings', ['id'], unique=False)
    op.create_index('ix_saved_listings_user_id', 'saved_listings', ['user_id'], unique=False)
    op.create_index('ix_saved_listings_listing_id', 'saved_listings', ['listing_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_saved_listings_listing_id', table_name='saved_listings')
    op.drop_index('ix_saved_listings_user_id', table_name='saved_listings')
    op.drop_index(op.f('ix_saved_listings_id'), table_name='saved_listings')
    op.drop_table('saved_listings')

