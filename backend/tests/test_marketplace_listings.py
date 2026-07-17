import pytest
from httpx import AsyncClient

from app.crud.user import create_user, update_user_status
from app.crud.user_compound_membership import ensure_user_compound_membership
from app.models.compound import Compound
from app.models.enums import ProviderStatus, UserRole, UserStatus
from app.models.service_provider import ServiceProviderProfile
from app.schemas.user import UserCreate


async def create_marketplace_user(
    db_session,
    *,
    email: str,
    role: UserRole | None,
    compound: Compound,
):
    user = await create_user(
        db_session,
        UserCreate(name="Marketplace User", email=email, password="password123"),
        role=role,
    )
    user.compound_id = compound.id
    await update_user_status(db_session, user.id, UserStatus.APPROVED)
    await ensure_user_compound_membership(
        db_session, user.id, compound.id, source="ADMIN"
    )
    await db_session.commit()
    return user


async def auth_headers(async_client: AsyncClient, email: str) -> dict[str, str]:
    response = await async_client.post(
        "/api/auth/login",
        json={"email": email, "password": "password123"},
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.mark.asyncio
@pytest.mark.unit
async def test_resident_listing_is_active_and_visible(async_client, db_session):
    compound = Compound(name="Marketplace Compound")
    db_session.add(compound)
    await db_session.flush()
    await create_marketplace_user(
        db_session,
        email="marketplace-resident@example.com",
        role=UserRole.RESIDENT,
        compound=compound,
    )
    headers = await auth_headers(async_client, "marketplace-resident@example.com")

    created = await async_client.post(
        "/api/listings",
        json={
            "category": "ITEM",
            "title": "Desk",
            "intent": "SELL",
            "attributes": {"condition": "USED"},
        },
        headers=headers,
    )
    visible = await async_client.get("/api/listings", headers=headers)

    assert created.status_code == 201
    assert created.json()["status"] == "ACTIVE"
    assert visible.status_code == 200
    assert [listing["id"] for listing in visible.json()] == [created.json()["id"]]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_legacy_user_can_create_listing(async_client, db_session):
    compound = Compound(name="Legacy Marketplace Compound")
    db_session.add(compound)
    await db_session.flush()
    await create_marketplace_user(
        db_session,
        email="legacy-marketplace@example.com",
        role=UserRole.USER,
        compound=compound,
    )
    headers = await auth_headers(async_client, "legacy-marketplace@example.com")

    response = await async_client.post(
        "/api/listings",
        json={"category": "ITEM", "title": "Chair", "intent": "SELL"},
        headers=headers,
    )

    assert response.status_code == 201
    assert response.json()["status"] == "ACTIVE"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_car_rent_is_rejected(async_client, db_session):
    compound = Compound(name="Car Intent Compound")
    db_session.add(compound)
    await db_session.flush()
    await create_marketplace_user(
        db_session,
        email="car-rent@example.com",
        role=UserRole.RESIDENT,
        compound=compound,
    )
    headers = await auth_headers(async_client, "car-rent@example.com")

    response = await async_client.post(
        "/api/listings",
        json={"category": "CAR", "title": "Car", "intent": "RENT"},
        headers=headers,
    )

    assert response.status_code == 422


@pytest.mark.asyncio
@pytest.mark.unit
async def test_car_attributes_round_trip_on_create_and_update(
    async_client, db_session
):
    compound = Compound(name="Car Attributes Compound")
    db_session.add(compound)
    await db_session.flush()
    await create_marketplace_user(
        db_session,
        email="car-attributes@example.com",
        role=UserRole.RESIDENT,
        compound=compound,
    )
    headers = await auth_headers(async_client, "car-attributes@example.com")
    attributes = {
        "make": "Toyota",
        "model": "Corolla",
        "year": 2022,
        "mileage_km": 30000,
        "transmission": "AUTOMATIC",
        "fuel_type": "PETROL",
    }

    created = await async_client.post(
        "/api/listings",
        json={
            "category": "CAR",
            "title": "Toyota Corolla",
            "intent": "SELL",
            "attributes": attributes,
        },
        headers=headers,
    )
    assert created.status_code == 201
    assert created.json()["attributes"] == attributes

    attributes["mileage_km"] = 31000
    updated = await async_client.patch(
        f"/api/listings/{created.json()['id']}",
        json={"attributes": attributes},
        headers=headers,
    )
    fetched = await async_client.get(
        f"/api/listings/{created.json()['id']}", headers=headers
    )

    assert updated.status_code == 200
    assert updated.json()["attributes"] == attributes
    assert fetched.status_code == 200
    assert fetched.json()["attributes"] == attributes


@pytest.mark.asyncio
@pytest.mark.unit
async def test_mismatched_attributes_are_rejected(async_client, db_session):
    compound = Compound(name="Mismatched Attributes Compound")
    db_session.add(compound)
    await db_session.flush()
    await create_marketplace_user(
        db_session,
        email="mismatched-attributes@example.com",
        role=UserRole.RESIDENT,
        compound=compound,
    )
    headers = await auth_headers(async_client, "mismatched-attributes@example.com")

    response = await async_client.post(
        "/api/listings",
        json={
            "category": "ITEM",
            "title": "Wrong attributes",
            "intent": "SELL",
            "attributes": {
                "make": "Toyota",
                "model": "Corolla",
                "year": 2022,
                "mileage_km": 30000,
                "transmission": "AUTOMATIC",
                "fuel_type": "PETROL",
            },
        },
        headers=headers,
    )

    assert response.status_code == 422


@pytest.mark.asyncio
@pytest.mark.unit
async def test_approved_provider_service_listing_uses_service_area_and_limit(
    async_client, db_session
):
    compound = Compound(name="Provider Service Area")
    db_session.add(compound)
    await db_session.flush()
    provider = await create_user(
        db_session,
        UserCreate(
            name="Approved Provider",
            email="approved-provider@example.com",
            password="password123",
        ),
        role=UserRole.SERVICE_PROVIDER,
    )
    await update_user_status(db_session, provider.id, UserStatus.APPROVED)
    db_session.add(
        ServiceProviderProfile(
            user_id=provider.id,
            business_name="Provider Business",
            service_area_compound_ids=[compound.id],
            provider_status=ProviderStatus.APPROVED,
            max_listings=1,
        )
    )
    await db_session.commit()
    headers = await auth_headers(async_client, "approved-provider@example.com")
    payload = {
        "category": "SERVICE",
        "title": "Home maintenance",
        "intent": "SELL",
    }

    created = await async_client.post("/api/listings", json=payload, headers=headers)
    limited = await async_client.post(
        "/api/listings",
        json={**payload, "title": "Second service"},
        headers=headers,
    )

    assert created.status_code == 201
    assert created.json()["status"] == "ACTIVE"
    assert created.json()["compound_name"] == compound.name
    assert limited.status_code == 403
