"""Add LLM verification fields to verification_documents

Revision ID: 003_add_llm_verification_fields
Revises: 002_add_csv_compound_fields
Create Date: 2024-01-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '003_add_llm_verification_fields'
down_revision = '002_add_csv_compound_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add REQUEST_MORE_DETAILS to DocumentStatus enum
    op.execute("ALTER TYPE documentstatus ADD VALUE IF NOT EXISTS 'REQUEST_MORE_DETAILS'")
    
    # Add LLM verification fields
    op.add_column('verification_documents', sa.Column('llm_verified', sa.Integer(), nullable=True))
    op.add_column('verification_documents', sa.Column('llm_confidence', sa.Float(), nullable=True))
    op.add_column('verification_documents', sa.Column('llm_recommendation', sa.String(), nullable=True))
    op.add_column('verification_documents', sa.Column('llm_reasoning', sa.Text(), nullable=True))
    op.add_column('verification_documents', sa.Column('llm_issues', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('verification_documents', sa.Column('llm_extracted_info', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('verification_documents', sa.Column('llm_verified_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    # Remove LLM verification fields
    op.drop_column('verification_documents', 'llm_verified_at')
    op.drop_column('verification_documents', 'llm_extracted_info')
    op.drop_column('verification_documents', 'llm_issues')
    op.drop_column('verification_documents', 'llm_reasoning')
    op.drop_column('verification_documents', 'llm_recommendation')
    op.drop_column('verification_documents', 'llm_confidence')
    op.drop_column('verification_documents', 'llm_verified')
    
    # Note: Cannot remove enum value in PostgreSQL easily, so we'll leave REQUEST_MORE_DETAILS

