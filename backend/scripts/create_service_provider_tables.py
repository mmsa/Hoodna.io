"""
Create service provider and moderator tables if they don't exist.
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings


async def create_tables():
    """Create service provider and moderator tables."""
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    
    async with engine.begin() as conn:
        # Check if service_provider_profiles table exists
        result = await conn.execute(text("""
            SELECT to_regclass('public.service_provider_profiles')
        """))
        table_exists = result.scalar_one_or_none()

        if not table_exists:
            print("🔄 Creating service provider and moderator tables...")
            
            # Create enums
            await conn.execute(text("""
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'providertype') THEN
                        CREATE TYPE providertype AS ENUM (
                            'INDIVIDUAL',
                            'REGISTERED_BUSINESS'
                        );
                    END IF;
                END $$;
            """))
            
            await conn.execute(text("""
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'providerverificationmethod') THEN
                        CREATE TYPE providerverificationmethod AS ENUM (
                            'COMMERCIAL_REGISTER',
                            'NATIONAL_ID_OCCUPATION'
                        );
                    END IF;
                END $$;
            """))
            
            await conn.execute(text("""
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'providerstatus') THEN
                        CREATE TYPE providerstatus AS ENUM (
                            'DRAFT',
                            'SUBMITTED',
                            'IN_REVIEW',
                            'APPROVED',
                            'REJECTED',
                            'SUSPENDED'
                        );
                    END IF;
                END $$;
            """))
            
            await conn.execute(text("""
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderatorstatus') THEN
                        CREATE TYPE moderatorstatus AS ENUM (
                            'DRAFT',
                            'SUBMITTED',
                            'IN_REVIEW',
                            'APPROVED',
                            'REJECTED',
                            'SUSPENDED'
                        );
                    END IF;
                END $$;
            """))
            
            # Create service_provider_profiles table
            await conn.execute(text("""
                CREATE TABLE service_provider_profiles (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
                    provider_type providertype,
                    verification_method providerverificationmethod,
                    business_name VARCHAR,
                    category_id INTEGER,
                    phone VARCHAR,
                    service_area_compound_ids INTEGER[],
                    occupation_text VARCHAR,
                    provider_status providerstatus NOT NULL DEFAULT 'DRAFT',
                    submitted_at TIMESTAMP WITH TIME ZONE,
                    reviewed_at TIMESTAMP WITH TIME ZONE,
                    reviewed_by INTEGER REFERENCES users(id),
                    rejection_reason TEXT,
                    suspension_reason TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
                );
            """))
            
            await conn.execute(text("CREATE INDEX ix_service_provider_profiles_id ON service_provider_profiles (id);"))
            await conn.execute(text("CREATE UNIQUE INDEX ix_service_provider_profiles_user_id ON service_provider_profiles (user_id);"))
            await conn.execute(text("CREATE INDEX ix_service_provider_profiles_provider_status ON service_provider_profiles (provider_status);"))
            
            # Create service_provider_documents table
            await conn.execute(text("""
                CREATE TABLE service_provider_documents (
                    id SERIAL PRIMARY KEY,
                    profile_id INTEGER NOT NULL REFERENCES service_provider_profiles(id),
                    document_type VARCHAR NOT NULL,
                    file_url VARCHAR NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
                );
            """))
            
            await conn.execute(text("CREATE INDEX ix_service_provider_documents_id ON service_provider_documents (id);"))
            await conn.execute(text("CREATE INDEX ix_service_provider_documents_profile_id ON service_provider_documents (profile_id);"))
            
            # Create compound_moderator_profiles table
            await conn.execute(text("""
                CREATE TABLE compound_moderator_profiles (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
                    compound_id INTEGER NOT NULL REFERENCES compounds(id),
                    role_title VARCHAR,
                    moderator_status moderatorstatus NOT NULL DEFAULT 'DRAFT',
                    submitted_at TIMESTAMP WITH TIME ZONE,
                    reviewed_at TIMESTAMP WITH TIME ZONE,
                    reviewed_by INTEGER REFERENCES users(id),
                    rejection_reason TEXT,
                    suspension_reason TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
                );
            """))
            
            await conn.execute(text("CREATE INDEX ix_compound_moderator_profiles_id ON compound_moderator_profiles (id);"))
            await conn.execute(text("CREATE UNIQUE INDEX ix_compound_moderator_profiles_user_id ON compound_moderator_profiles (user_id);"))
            await conn.execute(text("CREATE INDEX ix_compound_moderator_profiles_compound_id ON compound_moderator_profiles (compound_id);"))
            await conn.execute(text("CREATE INDEX ix_compound_moderator_profiles_moderator_status ON compound_moderator_profiles (moderator_status);"))
            
            # Create compound_moderator_documents table
            await conn.execute(text("""
                CREATE TABLE compound_moderator_documents (
                    id SERIAL PRIMARY KEY,
                    profile_id INTEGER NOT NULL REFERENCES compound_moderator_profiles(id),
                    document_type VARCHAR NOT NULL,
                    file_url VARCHAR NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
                );
            """))
            
            await conn.execute(text("CREATE INDEX ix_compound_moderator_documents_id ON compound_moderator_documents (id);"))
            await conn.execute(text("CREATE INDEX ix_compound_moderator_documents_profile_id ON compound_moderator_documents (profile_id);"))
            
            # Make users.role nullable if not already
            await conn.execute(text("""
                ALTER TABLE users ALTER COLUMN role DROP NOT NULL;
            """))
            
            print("✅ Created service provider and moderator tables.")
        else:
            print("☑️ service_provider_profiles table already exists.")


if __name__ == "__main__":
    asyncio.run(create_tables())

