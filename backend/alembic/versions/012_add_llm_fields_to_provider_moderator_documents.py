"""Add LLM verification fields to provider and moderator documents

Revision ID: 012
Revises: 011
Create Date: 2024-12-30 23:35:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '012'
down_revision: str | None = '011'
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    # Add LLM verification fields to service_provider_documents
    op.add_column('service_provider_documents', sa.Column('llm_verified', sa.Integer(), nullable=True))
    op.add_column('service_provider_documents', sa.Column('llm_confidence', sa.Float(), nullable=True))
    op.add_column('service_provider_documents', sa.Column('llm_recommendation', sa.String(), nullable=True))
    op.add_column('service_provider_documents', sa.Column('llm_reasoning', sa.Text(), nullable=True))
    op.add_column('service_provider_documents', sa.Column('llm_issues', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('service_provider_documents', sa.Column('llm_extracted_info', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('service_provider_documents', sa.Column('llm_verified_at', sa.DateTime(timezone=True), nullable=True))
    
    # Add LLM verification fields to compound_moderator_documents
    op.add_column('compound_moderator_documents', sa.Column('llm_verified', sa.Integer(), nullable=True))
    op.add_column('compound_moderator_documents', sa.Column('llm_confidence', sa.Float(), nullable=True))
    op.add_column('compound_moderator_documents', sa.Column('llm_recommendation', sa.String(), nullable=True))
    op.add_column('compound_moderator_documents', sa.Column('llm_reasoning', sa.Text(), nullable=True))
    op.add_column('compound_moderator_documents', sa.Column('llm_issues', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('compound_moderator_documents', sa.Column('llm_extracted_info', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('compound_moderator_documents', sa.Column('llm_verified_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    # Remove LLM verification fields from compound_moderator_documents
    op.drop_column('compound_moderator_documents', 'llm_verified_at')
    op.drop_column('compound_moderator_documents', 'llm_extracted_info')
    op.drop_column('compound_moderator_documents', 'llm_issues')
    op.drop_column('compound_moderator_documents', 'llm_reasoning')
    op.drop_column('compound_moderator_documents', 'llm_recommendation')
    op.drop_column('compound_moderator_documents', 'llm_confidence')
    op.drop_column('compound_moderator_documents', 'llm_verified')
    
    # Remove LLM verification fields from service_provider_documents
    op.drop_column('service_provider_documents', 'llm_verified_at')
    op.drop_column('service_provider_documents', 'llm_extracted_info')
    op.drop_column('service_provider_documents', 'llm_issues')
    op.drop_column('service_provider_documents', 'llm_reasoning')
    op.drop_column('service_provider_documents', 'llm_recommendation')
    op.drop_column('service_provider_documents', 'llm_confidence')
    op.drop_column('service_provider_documents', 'llm_verified')

