import pytest
from httpx import AsyncClient

from app.crud.user import create_user
from app.models.compound import Compound
from app.models.enums import UserRole
from app.schemas.user import UserCreate


@pytest.mark.asyncio
@pytest.mark.unit
async def test_national_id_submit_is_pending_in_status_and_current_user(
    async_client: AsyncClient, db_session
):
    compound = Compound(name="Pending Verification Compound")
    db_session.add(compound)
    await db_session.flush()

    user = await create_user(
        db_session,
        UserCreate(
            name="Pending Resident",
            email="pending-resident@example.com",
            password="password123",
        ),
        role=UserRole.RESIDENT,
    )
    user.compound_id = compound.id
    await db_session.commit()

    login_response = await async_client.post(
        "/api/auth/login",
        json={
            "email": "pending-resident@example.com",
            "password": "password123",
        },
    )
    headers = {
        "Authorization": f"Bearer {login_response.json()['access_token']}"
    }

    submit_response = await async_client.post(
        "/api/verification/submit",
        json={
            "document_type": "NATIONAL_ID",
            "file_url": "https://example.com/national-id.jpg",
        },
        headers=headers,
    )
    me_response = await async_client.get("/api/auth/me", headers=headers)
    status_response = await async_client.get(
        "/api/verification/status", headers=headers
    )

    assert submit_response.status_code == 201
    assert me_response.status_code == 200
    assert me_response.json()["verification_status"] == "PENDING"
    assert status_response.status_code == 200
    assert status_response.json()["national_id"]["status"] == "PENDING"
