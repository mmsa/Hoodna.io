import pytest
from httpx import AsyncClient

from app.crud.user import create_user, update_user_status
from app.crud.user_compound_membership import ensure_user_compound_membership
from app.models.compound import Compound
from app.models.enums import UserRole, UserStatus
from app.models.feature_flag import FeatureFlag
from app.schemas.user import UserCreate
from app.services.feature_flags import clear_feature_flag_cache


@pytest.mark.asyncio
@pytest.mark.unit
async def test_legacy_user_role_can_create_post(async_client: AsyncClient, db_session):
    compound = Compound(name="Legacy Resident Compound")
    db_session.add_all(
        [
            compound,
            FeatureFlag(key="community_posting", enabled=True, config={}),
        ]
    )
    await db_session.flush()

    user = await create_user(
        db_session,
        UserCreate(
            name="Legacy Resident",
            email="legacy-resident@example.com",
            password="password123",
        ),
        role=UserRole.USER,
    )
    user.compound_id = compound.id
    await update_user_status(db_session, user.id, UserStatus.APPROVED)
    await ensure_user_compound_membership(
        db_session, user.id, compound.id, source="ADMIN"
    )
    await db_session.commit()
    clear_feature_flag_cache()

    login_response = await async_client.post(
        "/api/auth/login",
        json={
            "email": "legacy-resident@example.com",
            "password": "password123",
        },
    )
    response = await async_client.post(
        "/api/posts",
        json={"content": "Hello, neighbours"},
        headers={
            "Authorization": f"Bearer {login_response.json()['access_token']}"
        },
    )
    clear_feature_flag_cache()

    assert response.status_code == 201
    assert response.json()["content"] == "Hello, neighbours"
