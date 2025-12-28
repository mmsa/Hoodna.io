"""Add CSV compound fields

Revision ID: 002
Revises: 001
Create Date: 2025-12-28 15:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to compounds table (nullable initially to handle existing data)
    op.add_column('compounds', sa.Column('compound_id', sa.String(), nullable=True))
    op.add_column('compounds', sa.Column('area', sa.String(), nullable=True))
    op.add_column('compounds', sa.Column('sub_area', sa.String(), nullable=True))
    op.add_column('compounds', sa.Column('category', sa.String(), nullable=True))
    op.add_column('compounds', sa.Column('developer', sa.String(), nullable=True))
    op.add_column('compounds', sa.Column('status_2025', sa.String(), nullable=True))
    op.add_column('compounds', sa.Column('delivery_notes', sa.Text(), nullable=True))
    op.add_column('compounds', sa.Column('source_hint', sa.String(), nullable=True))
    op.add_column('compounds', sa.Column('last_verified_date', sa.Date(), nullable=True))
    op.add_column('compounds', sa.Column('lat', sa.Numeric(10, 7), nullable=True))
    op.add_column('compounds', sa.Column('lng', sa.Numeric(10, 7), nullable=True))
    op.add_column('compounds', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True))
    
    # Make city nullable (it can be derived from area)
    op.alter_column('compounds', 'city', nullable=True)
    
    # Create indexes (compound_id index without unique constraint initially since it may be NULL)
    op.create_index(op.f('ix_compounds_compound_id'), 'compounds', ['compound_id'], unique=False)
    op.create_index(op.f('ix_compounds_area'), 'compounds', ['area'], unique=False)
    op.create_index(op.f('ix_compounds_sub_area'), 'compounds', ['sub_area'], unique=False)
    op.create_index(op.f('ix_compounds_category'), 'compounds', ['category'], unique=False)
    op.create_index(op.f('ix_compounds_developer'), 'compounds', ['developer'], unique=False)
    op.create_index(op.f('ix_compounds_status_2025'), 'compounds', ['status_2025'], unique=False)
    
    # Create composite indexes
    op.create_index('ix_compounds_area_status', 'compounds', ['area', 'status_2025'], unique=False)
    op.create_index('ix_compounds_developer_status', 'compounds', ['developer', 'status_2025'], unique=False)
    op.create_index('ix_compounds_category_status', 'compounds', ['category', 'status_2025'], unique=False)
    
    # Note: After seeding compounds from CSV, you should:
    # 1. Ensure all compounds have compound_id populated
    # 2. Add unique constraint: op.create_unique_constraint('uq_compounds_compound_id', 'compounds', ['compound_id'])
    # 3. Make compound_id and area NOT NULL if desired


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_compounds_category_status', table_name='compounds')
    op.drop_index('ix_compounds_developer_status', table_name='compounds')
    op.drop_index('ix_compounds_area_status', table_name='compounds')
    op.drop_index(op.f('ix_compounds_status_2025'), table_name='compounds')
    op.drop_index(op.f('ix_compounds_developer'), table_name='compounds')
    op.drop_index(op.f('ix_compounds_category'), table_name='compounds')
    op.drop_index(op.f('ix_compounds_sub_area'), table_name='compounds')
    op.drop_index(op.f('ix_compounds_area'), table_name='compounds')
    op.drop_index(op.f('ix_compounds_compound_id'), table_name='compounds')
    
    # Drop columns
    op.drop_column('compounds', 'updated_at')
    op.drop_column('compounds', 'lng')
    op.drop_column('compounds', 'lat')
    op.drop_column('compounds', 'last_verified_date')
    op.drop_column('compounds', 'source_hint')
    op.drop_column('compounds', 'delivery_notes')
    op.drop_column('compounds', 'status_2025')
    op.drop_column('compounds', 'developer')
    op.drop_column('compounds', 'category')
    op.drop_column('compounds', 'sub_area')
    op.drop_column('compounds', 'area')
    op.drop_column('compounds', 'compound_id')
    
    # Make city NOT NULL again
    op.alter_column('compounds', 'city', nullable=False)

