"""
Unit tests for authentication endpoints.
"""
import pytest
from io import BytesIO
from httpx import AsyncClient
from PIL import Image
from app.crud.user_compound_membership import ensure_user_compound_membership
from app.models.compound import Compound
from app.models.user import User
from app.models.enums import UserRole, UserStatus
from app.schemas.user import UserCreate
from app.core.security import get_password_hash


@pytest.mark.asyncio
@pytest.mark.unit
async def test_signup_success(async_client: AsyncClient, db_session):
    """Test successful user signup."""
    response = await async_client.post(
        "/api/auth/signup",
        json={
            "name": "New User",
            "email": "newuser@example.com",
            "phone": "+201234567890",
            "password": "password123",
            "role": "USER",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == "newuser@example.com"
    assert data["user"]["role"] == "USER"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_signup_duplicate_email(async_client: AsyncClient, db_session):
    """Test signup with duplicate email fails."""
    # First signup
    await async_client.post(
        "/api/auth/signup",
        json={
            "name": "User 1",
            "email": "duplicate@example.com",
            "phone": "+201234567890",
            "password": "password123",
            "role": "USER",
        },
    )
    
    # Second signup with same email
    response = await async_client.post(
        "/api/auth/signup",
        json={
            "name": "User 2",
            "email": "duplicate@example.com",
            "phone": "+201234567891",
            "password": "password123",
            "role": "USER",
        },
    )
    assert response.status_code == 400
    assert "email" in response.json()["detail"].lower()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_login_success(async_client: AsyncClient, db_session):
    """Test successful login."""
    # Create user first
    from app.crud.user import create_user
    user_data = UserCreate(
        name="Test User",
        email="login@example.com",
        phone="+201234567890",
        password="password123",
    )
    await create_user(db_session, user_data, role=UserRole.USER)
    
    # Login
    response = await async_client.post(
        "/api/auth/login",
        json={
            "email": "login@example.com",
            "password": "password123",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
@pytest.mark.unit
async def test_login_with_phone(async_client: AsyncClient, db_session):
    """Password login accepts phone number as identifier."""
    from app.crud.user import create_user

    user_data = UserCreate(
        name="Phone Login User",
        email="phonelogin@example.com",
        phone="201098765432",
        password="password123",
    )
    await create_user(db_session, user_data, role=UserRole.USER)

    response = await async_client.post(
        "/api/auth/login",
        json={
            "email": "201098765432",
            "password": "password123",
        },
    )
    assert response.status_code == 200
    assert "access_token" in response.json()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_login_invalid_credentials(async_client: AsyncClient, db_session):
    """Test login with invalid credentials."""
    response = await async_client.post(
        "/api/auth/login",
        json={
            "email": "nonexistent@example.com",
            "password": "wrongpassword",
        },
    )
    assert response.status_code == 401

@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_current_user_authenticated(async_client: AsyncClient, db_session):
    """Test getting current user info when authenticated."""
    # Create and login user
    from app.crud.user import create_user, update_user_status
    user_data = UserCreate(
        name="Test User",
        email="me@example.com",
        phone="+201234567890",
        password="password123",
    )
    user = await create_user(db_session, user_data, role=UserRole.USER)
    await update_user_status(db_session, user.id, UserStatus.APPROVED)
    
    # Login to get token
    login_response = await async_client.post(
        "/api/auth/login",
        json={
            "email": "me@example.com",
            "password": "password123",
        },
    )
    token = login_response.json()["access_token"]
    
    # Get current user
    response = await async_client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "me@example.com"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_verified_compound_member_can_post_without_llm_metadata(
    async_client: AsyncClient, db_session
):
    """Verified membership is the posting permission source of truth."""
    from app.crud.user import create_user, update_user_status

    compound = Compound(name="Verified Compound")
    db_session.add(compound)
    await db_session.flush()

    user = await create_user(
        db_session,
        UserCreate(
            name="Verified Resident",
            email="verified-resident@example.com",
            password="password123",
        ),
        role=UserRole.RESIDENT,
    )
    user.compound_id = compound.id
    await update_user_status(db_session, user.id, UserStatus.APPROVED)
    await ensure_user_compound_membership(
        db_session, user.id, compound.id, source="ADMIN"
    )
    await db_session.commit()

    login_response = await async_client.post(
        "/api/auth/login",
        json={
            "email": "verified-resident@example.com",
            "password": "password123",
        },
    )
    token = login_response.json()["access_token"]
    response = await async_client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["verification_status"] == "APPROVED"
    assert data["is_verified_for_current_compound"] is True
    assert data["can_post"] is True


@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_current_user_unauthenticated(async_client: AsyncClient):
    """Test getting current user info without authentication."""
    response = await async_client.get("/api/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.unit
async def test_user_can_upload_profile_picture(
    async_client: AsyncClient, monkeypatch
):
    signup = await async_client.post(
        "/api/auth/signup",
        json={
            "name": "Avatar User",
            "email": "avatar@example.com",
            "password": "password123",
            "role": "RESIDENT",
        },
    )
    token = signup.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    external = await async_client.put(
        "/api/auth/me/avatar",
        headers=headers,
        json={"avatar_url": "https://example.com/not-owned.png"},
    )
    assert external.status_code == 400

    presign = await async_client.post(
        "/api/auth/me/avatar/presign",
        headers=headers,
        json={"file_name": "avatar.png", "file_type": "image/png"},
    )
    assert presign.status_code == 200
    assert presign.json()["file_url"]

    image_buffer = BytesIO()
    Image.new("RGB", (128, 128), color=(21, 128, 116)).save(
        image_buffer, format="PNG"
    )
    monkeypatch.setattr(
        "app.services.s3.download_file_bytes",
        lambda _: image_buffer.getvalue(),
    )
    monkeypatch.setattr("app.services.storage.use_local_storage", lambda: True)

    update = await async_client.put(
        "/api/auth/me/avatar",
        headers=headers,
        json={"avatar_url": presign.json()["file_url"]},
    )
    assert update.status_code == 200
    assert update.json()["avatar_url"] == presign.json()["file_url"]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_signup_rejects_privileged_roles(async_client: AsyncClient):
    """Signup must not allow ADMIN or MODERATOR role escalation."""
    for role in ("ADMIN", "MODERATOR"):
        response = await async_client.post(
            "/api/auth/signup",
            json={
                "name": f"Bad {role}",
                "email": f"bad-{role.lower()}@example.com",
                "password": "password123",
                "role": role,
            },
        )
        assert response.status_code == 400
        assert "role" in response.json()["detail"].lower()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_local_upload_rejects_foreign_profile_path(
    async_client: AsyncClient, monkeypatch
):
    """Local uploads must stay under profiles/{user_id}/."""
    monkeypatch.setattr("app.services.storage.use_local_storage", lambda: True)

    signup = await async_client.post(
        "/api/auth/signup",
        json={
            "name": "Upload User",
            "email": "upload@example.com",
            "password": "password123",
            "role": "RESIDENT",
        },
    )
    token = signup.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    image_buffer = BytesIO()
    Image.new("RGB", (32, 32), color=(21, 128, 116)).save(image_buffer, format="PNG")
    image_buffer.seek(0)

    traversal = await async_client.post(
        "/api/uploads/upload?file_path=profiles/999/evil.png",
        headers=headers,
        files={"file": ("evil.png", image_buffer.getvalue(), "image/png")},
    )
    assert traversal.status_code == 403

    image_buffer.seek(0)
    invalid = await async_client.post(
        "/api/uploads/upload?file_path=../secrets.png",
        headers=headers,
        files={"file": ("secrets.png", image_buffer.getvalue(), "image/png")},
    )
    assert invalid.status_code == 400
