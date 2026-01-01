"""add provider and moderator tables

Revision ID: 011
Revises: 010
Create Date: 2024-12-30 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.sql import func


# revision identifiers, used by Alembic.
revision: str = '011'
down_revision: str | None = '010'
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    # Create or reuse enums (idempotent)
    providertype_enum = postgresql.ENUM(
        'INDIVIDUAL',
        'REGISTERED_BUSINESS',
        name='providertype',
        create_type=False,
    )
    providerverificationmethod_enum = postgresql.ENUM(
        'COMMERCIAL_REGISTER',
        'NATIONAL_ID_OCCUPATION',
        name='providerverificationmethod',
        create_type=False,
    )
    providerstatus_enum = postgresql.ENUM(
        'DRAFT',
        'SUBMITTED',
        'IN_REVIEW',
        'APPROVED',
        'REJECTED',
        'SUSPENDED',
        name='providerstatus',
        create_type=False,
    )
    moderatorstatus_enum = postgresql.ENUM(
        'DRAFT',
        'SUBMITTED',
        'IN_REVIEW',
        'APPROVED',
        'REJECTED',
        'SUSPENDED',
        name='moderatorstatus',
        create_type=False,
    )

    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'providertype') THEN
                CREATE TYPE providertype AS ENUM ('INDIVIDUAL', 'REGISTERED_BUSINESS');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'providerverificationmethod') THEN
                CREATE TYPE providerverificationmethod AS ENUM ('COMMERCIAL_REGISTER', 'NATIONAL_ID_OCCUPATION');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'providerstatus') THEN
                CREATE TYPE providerstatus AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderatorstatus') THEN
                CREATE TYPE moderatorstatus AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED');
            END IF;
        END$$;
    """)
    
    # Create service_provider_profiles table
    op.create_table(
        'service_provider_profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('provider_type', providertype_enum, nullable=True),
        sa.Column('verification_method', providerverificationmethod_enum, nullable=True),
        sa.Column('business_name', sa.String(), nullable=True),
        sa.Column('category_id', sa.Integer(), nullable=True),
        sa.Column('phone', sa.String(), nullable=True),
        sa.Column('service_area_compound_ids', postgresql.ARRAY(sa.Integer()), nullable=True),
        sa.Column('occupation_text', sa.String(), nullable=True),
        sa.Column('provider_status', providerstatus_enum, nullable=False, server_default='DRAFT'),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reviewed_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('suspension_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    op.create_index('ix_service_provider_profiles_id', 'service_provider_profiles', ['id'], unique=False)
    op.create_index('ix_service_provider_profiles_user_id', 'service_provider_profiles', ['user_id'], unique=True)
    op.create_index('ix_service_provider_profiles_provider_status', 'service_provider_profiles', ['provider_status'], unique=False)
    
    # Create service_provider_documents table
    op.create_table(
        'service_provider_documents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('profile_id', sa.Integer(), sa.ForeignKey('service_provider_profiles.id'), nullable=False),
        sa.Column('document_type', sa.String(), nullable=False),
        sa.Column('file_url', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_service_provider_documents_id', 'service_provider_documents', ['id'], unique=False)
    op.create_index('ix_service_provider_documents_profile_id', 'service_provider_documents', ['profile_id'], unique=False)
    
    # Create compound_moderator_profiles table
    op.create_table(
        'compound_moderator_profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('compound_id', sa.Integer(), sa.ForeignKey('compounds.id'), nullable=False),
        sa.Column('role_title', sa.String(), nullable=True),
        sa.Column('moderator_status', moderatorstatus_enum, nullable=False, server_default='DRAFT'),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reviewed_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('suspension_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    op.create_index('ix_compound_moderator_profiles_id', 'compound_moderator_profiles', ['id'], unique=False)
    op.create_index('ix_compound_moderator_profiles_user_id', 'compound_moderator_profiles', ['user_id'], unique=True)
    op.create_index('ix_compound_moderator_profiles_compound_id', 'compound_moderator_profiles', ['compound_id'], unique=False)
    op.create_index('ix_compound_moderator_profiles_moderator_status', 'compound_moderator_profiles', ['moderator_status'], unique=False)
    
    # Create compound_moderator_documents table
    op.create_table(
        'compound_moderator_documents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('profile_id', sa.Integer(), sa.ForeignKey('compound_moderator_profiles.id'), nullable=False),
        sa.Column('document_type', sa.String(), nullable=False),
        sa.Column('file_url', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_compound_moderator_documents_id', 'compound_moderator_documents', ['id'], unique=False)
    op.create_index('ix_compound_moderator_documents_profile_id', 'compound_moderator_documents', ['profile_id'], unique=False)
    
    # Update users.role to allow NULL
    op.alter_column('users', 'role', nullable=True)


def downgrade() -> None:
    # Drop tables
    op.drop_index('ix_compound_moderator_documents_profile_id', table_name='compound_moderator_documents')
    op.drop_index('ix_compound_moderator_documents_id', table_name='compound_moderator_documents')
    op.drop_table('compound_moderator_documents')
    
    op.drop_index('ix_compound_moderator_profiles_moderator_status', table_name='compound_moderator_profiles')
    op.drop_index('ix_compound_moderator_profiles_compound_id', table_name='compound_moderator_profiles')
    op.drop_index('ix_compound_moderator_profiles_user_id', table_name='compound_moderator_profiles')
    op.drop_index('ix_compound_moderator_profiles_id', table_name='compound_moderator_profiles')
    op.drop_table('compound_moderator_profiles')
    
    op.drop_index('ix_service_provider_documents_profile_id', table_name='service_provider_documents')
    op.drop_index('ix_service_provider_documents_id', table_name='service_provider_documents')
    op.drop_table('service_provider_documents')
    
    op.drop_index('ix_service_provider_profiles_provider_status', table_name='service_provider_profiles')
    op.drop_index('ix_service_provider_profiles_user_id', table_name='service_provider_profiles')
    op.drop_index('ix_service_provider_profiles_id', table_name='service_provider_profiles')
    op.drop_table('service_provider_profiles')
    
    # Drop enums
    op.execute("DROP TYPE IF EXISTS moderatorstatus")
    op.execute("DROP TYPE IF EXISTS providerstatus")
    op.execute("DROP TYPE IF EXISTS providerverificationmethod")
    op.execute("DROP TYPE IF EXISTS providertype")
    
    # Revert users.role to NOT NULL (set default for existing NULLs first)
    op.execute("UPDATE users SET role = 'USER' WHERE role IS NULL")
    op.alter_column('users', 'role', nullable=False)
