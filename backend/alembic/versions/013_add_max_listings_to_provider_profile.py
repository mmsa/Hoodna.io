"""add max_listings to provider profile

Revision ID: 013
Revises: 012
Create Date: 2025-12-31 00:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '013'
down_revision = '012'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add max_listings column to service_provider_profiles
    op.add_column('service_provider_profiles', 
                  sa.Column('max_listings', sa.Integer(), nullable=True, server_default='3'))
    # Set default to 3 for existing providers
    op.execute("UPDATE service_provider_profiles SET max_listings = 3 WHERE max_listings IS NULL")


def downgrade() -> None:
    op.drop_column('service_provider_profiles', 'max_listings')

