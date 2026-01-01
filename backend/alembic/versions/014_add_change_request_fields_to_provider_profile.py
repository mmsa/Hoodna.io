"""add change request fields to provider profile

Revision ID: 014
Revises: 013
Create Date: 2025-12-31 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '014'
down_revision = '013'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ensure service_categories exists (previously created by script, make migration-safe)
    op.execute("""
        CREATE TABLE IF NOT EXISTS service_categories (
            id SERIAL PRIMARY KEY,
            name VARCHAR NOT NULL,
            description TEXT,
            icon VARCHAR,
            display_order INTEGER DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes WHERE tablename = 'service_categories' AND indexname = 'ix_service_categories_id'
            ) THEN
                CREATE INDEX ix_service_categories_id ON service_categories (id);
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes WHERE tablename = 'service_categories' AND indexname = 'ix_service_categories_name'
            ) THEN
                CREATE INDEX ix_service_categories_name ON service_categories (name);
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes WHERE tablename = 'service_categories' AND indexname = 'ix_service_categories_is_active'
            ) THEN
                CREATE INDEX ix_service_categories_is_active ON service_categories (is_active);
            END IF;
        END$$;
    """)

    # Add change request fields to service_provider_profiles
    op.add_column('service_provider_profiles', 
                  sa.Column('category_change_request', sa.Integer(), nullable=True))
    op.add_column('service_provider_profiles', 
                  sa.Column('compounds_change_request', postgresql.ARRAY(sa.Integer()), nullable=True))
    op.add_column('service_provider_profiles', 
                  sa.Column('change_request_reason', sa.Text(), nullable=True))
    op.add_column('service_provider_profiles', 
                  sa.Column('change_request_status', sa.String(), nullable=True))
    op.add_column('service_provider_profiles', 
                  sa.Column('change_request_reviewed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('service_provider_profiles', 
                  sa.Column('change_request_reviewed_by', sa.Integer(), nullable=True))
    
    # Add foreign key constraint for category_change_request
    op.create_foreign_key(
        'fk_provider_category_change_request',
        'service_provider_profiles',
        'service_categories',
        ['category_change_request'],
        ['id']
    )
    
    # Add foreign key constraint for change_request_reviewed_by
    op.create_foreign_key(
        'fk_provider_change_request_reviewed_by',
        'service_provider_profiles',
        'users',
        ['change_request_reviewed_by'],
        ['id']
    )


def downgrade() -> None:
    # Drop foreign keys first
    op.drop_constraint('fk_provider_change_request_reviewed_by', 'service_provider_profiles', type_='foreignkey')
    op.drop_constraint('fk_provider_category_change_request', 'service_provider_profiles', type_='foreignkey')
    
    # Drop columns
    op.drop_column('service_provider_profiles', 'change_request_reviewed_by')
    op.drop_column('service_provider_profiles', 'change_request_reviewed_at')
    op.drop_column('service_provider_profiles', 'change_request_status')
    op.drop_column('service_provider_profiles', 'change_request_reason')
    op.drop_column('service_provider_profiles', 'compounds_change_request')
    op.drop_column('service_provider_profiles', 'category_change_request')
