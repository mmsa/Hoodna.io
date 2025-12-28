"""
Quick script to verify compounds in database
"""
import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select
from app.db.base import Base
# Import all models to ensure relationships are set up
from app.models import compound, user, post, listing, verification  # noqa
from app.models.compound import Compound
from app.core.config import settings

async def verify_compounds():
    db_url = os.getenv("DATABASE_URL", settings.DATABASE_URL)
    if "postgres:5432" in db_url:
        db_url = db_url.replace("postgres:5432", "localhost:5433")
    
    engine = create_async_engine(db_url)
    async_session = async_sessionmaker(engine)
    
    async with async_session() as session:
        result = await session.execute(select(Compound))
        compounds = result.scalars().all()
        
        print(f"\n📊 Database Summary:")
        print(f"   Total compounds: {len(compounds)}")
        
        # Group by city
        by_city = {}
        for c in compounds:
            if c.city not in by_city:
                by_city[c.city] = []
            by_city[c.city].append(c.name)
        
        print(f"\n📍 Compounds by City:")
        for city, comps in sorted(by_city.items()):
            print(f"   {city}: {len(comps)} compounds")
            for comp in sorted(comps)[:5]:  # Show first 5
                print(f"      - {comp}")
            if len(comps) > 5:
                print(f"      ... and {len(comps) - 5} more")
        
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(verify_compounds())

