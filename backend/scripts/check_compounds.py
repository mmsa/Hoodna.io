"""
Script to check and verify compounds in database.
"""

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select

# Import all models to ensure relationships are set up
from app.models import compound, user, post, listing, verification  # noqa
from app.models.compound import Compound
from scripts.utils import get_db_url


async def check_compounds():
    """Check and display compounds in the database."""
    db_url = get_db_url()
    engine = create_async_engine(db_url)
    async_session = async_sessionmaker(engine)

    async with async_session() as session:
        result = await session.execute(select(Compound))
        compounds = result.scalars().all()

        print(f"\n📊 Database Summary:")
        print(f"   Total compounds: {len(compounds)}\n")

        # Group by area (or city for legacy compounds)
        by_area = {}
        for c in compounds:
            area = c.area or c.city or "Unknown"
            if area not in by_area:
                by_area[area] = []
            by_area[area].append(c)

        print("📍 Compounds by Area:")
        for area, comps in sorted(by_area.items()):
            print(f"   {area}: {len(comps)} compounds")
            for comp in sorted(comps, key=lambda x: x.name)[:5]:  # Show first 5
                status = f" ({comp.status_2025})" if comp.status_2025 else ""
                print(f"      - {comp.name}{status}")
            if len(comps) > 5:
                print(f"      ... and {len(comps) - 5} more")

        # Show compounds with compound_id
        with_id = [c for c in compounds if c.compound_id]
        without_id = [c for c in compounds if not c.compound_id]

        if with_id:
            print(f"\n✅ Compounds with compound_id: {len(with_id)}")
        if without_id:
            print(f"⚠️  Compounds without compound_id (legacy): {len(without_id)}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(check_compounds())
