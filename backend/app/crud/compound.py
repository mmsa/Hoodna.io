from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.compound import Compound
from app.schemas.compound import CompoundCreate


async def get_compounds(db: AsyncSession, skip: int = 0, limit: int = 100) -> list[Compound]:
    """Get all compounds."""
    result = await db.execute(
        select(Compound).offset(skip).limit(limit)
    )
    return list(result.scalars().all())


async def get_compound_by_id(db: AsyncSession, compound_id: int) -> Compound | None:
    """Get compound by ID."""
    return await db.get(Compound, compound_id)


async def create_compound(db: AsyncSession, compound_data: CompoundCreate) -> Compound:
    """Create a new compound."""
    db_compound = Compound(**compound_data.model_dump())
    db.add(db_compound)
    await db.flush()
    await db.refresh(db_compound)
    return db_compound

