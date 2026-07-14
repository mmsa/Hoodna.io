from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.account import get_or_create_preferences
from app.i18n.notifications import normalize_locale


async def get_user_locale(db: AsyncSession, user_id: int) -> str:
    preference = await get_or_create_preferences(db, user_id)
    values = preference.preferences if preference.preferences else {}
    return normalize_locale(values.get("locale"))
