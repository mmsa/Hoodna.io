"""
Run all pending Alembic migrations.
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from alembic.config import Config
from alembic import command
from alembic.script import ScriptDirectory
from alembic.runtime.migration import MigrationContext
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings


async def run_migrations():
    """Run all pending migrations."""
    # Create Alembic config
    alembic_cfg = Config(str(backend_dir / "alembic.ini"))
    
    # Set database URL if not in alembic.ini
    if not alembic_cfg.get_main_option("sqlalchemy.url"):
        alembic_cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
    
    # Check current revision
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    
    try:
        async with engine.begin() as conn:
            context = MigrationContext.configure(await conn.run_sync(lambda sync_conn: sync_conn))
            current_rev = context.get_current_revision()
            print(f"Current database revision: {current_rev}")
            
            # Get script directory
            script = ScriptDirectory.from_config(alembic_cfg)
            head_rev = script.get_current_head()
            print(f"Latest migration revision: {head_rev}")
            
            if current_rev == head_rev:
                print("✅ Database is up to date!")
                return
            
            print(f"\n🔄 Running migrations from {current_rev} to {head_rev}...")
            
    finally:
        await engine.dispose()
    
    # Run migrations
    print("\nRunning migrations...")
    command.upgrade(alembic_cfg, "head")
    print("\n✅ Migrations completed!")


if __name__ == "__main__":
    asyncio.run(run_migrations())

