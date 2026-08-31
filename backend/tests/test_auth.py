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
    assert data["user"]["phone_verified"] is False
    assert data["user"]["email_verified"] is False
    assert data["user"]["needs_contact_verification"] is True


@pytest.mark.asyncio
@pytest.mark.unit
async def test_signup_without_role_leaves_role_null(async_client: AsyncClient):
    """Web signup omits role until choose-role; must not default to RESIDENT."""
    response = await async_client.post(
        "/api/auth/signup",
        json={
            "name": "No Role User",
            "phone": "+201111111111",
            "password": "password123",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["user"]["role"] is None
    assert data["user"]["phone_verified"] is False
    assert data["user"]["email_verified"] is True  # placeholder email
    assert data["user"]["needs_contact_verification"] is True


@pytest.mark.asyncio
@pytest.mark.unit
async def test_confirm_phone_otp_after_signup(async_client: AsyncClient):
    """Contact OTP gate: confirm-phone clears needs_contact_verification."""
    from app.api.auth import otp_storage
    from app.utils.phone import normalize_phone

    phone = "+201222222222"
    signup = await async_client.post(
        "/api/auth/signup",
        json={
            "name": "OTP User",
            "phone": phone,
            "password": "password123",
        },
    )
    assert signup.status_code == 201
    token = signup.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    normalized = normalize_phone(phone)
    assert normalized in otp_storage
    code = otp_storage[normalized]["otp"]

    me_before = await async_client.get("/api/auth/me", headers=headers)
    assert me_before.json()["needs_contact_verification"] is True

    confirm = await async_client.post(
        "/api/auth/confirm-phone",
        headers=headers,
        json={"otp_code": code},
    )
    assert confirm.status_code == 200
    assert confirm.json()["phone_verified"] is True

    me_after = await async_client.get("/api/auth/me", headers=headers)
    assert me_after.json()["phone_verified"] is True
    assert me_after.json()["needs_contact_verification"] is False


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
            "phone": "+201555555555",
            "password": "password123",
            "role": "RESIDENT",
        },
    )
    assert signup.status_code == 201
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
                "phone": f"+20100000{len(role):04d}",
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
            "phone": "+201333333333",
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


@pytest.mark.asyncio
@pytest.mark.unit
async def test_login_without_password_prompts_phone_otp(async_client: AsyncClient, db_session):
    """Imported / phone-OTP accounts cannot use password login until they set one."""
    from app.crud.user import create_user_by_phone

    await create_user_by_phone(db_session, "+201555555555", "Imported Neighbour")
    await db_session.commit()

    response = await async_client.post(
        "/api/auth/login",
        json={"email": "+201555555555", "password": "guessing"},
    )
    assert response.status_code == 401
    detail = response.json()["detail"].lower()
    assert "verification code" in detail


@pytest.mark.asyncio
@pytest.mark.unit
async def test_signup_duplicate_phone_points_to_otp_login(async_client: AsyncClient):
    first = await async_client.post(
        "/api/auth/signup",
        json={
            "name": "First User",
            "phone": "+201444444444",
            "password": "password123",
        },
    )
    assert first.status_code == 201

    duplicate = await async_client.post(
        "/api/auth/signup",
        json={
            "name": "Second User",
            "phone": "+201444444444",
            "password": "password123",
        },
    )
    assert duplicate.status_code == 400
    detail = duplicate.json()["detail"].lower()
    assert "already registered" in detail
    assert "verification code" in detail


@pytest.mark.asyncio
@pytest.mark.unit
async def test_reset_password_via_phone_otp(async_client: AsyncClient, db_session):
    """Phone OTP can set a password on an imported account."""
    import time
    from app.api.auth import otp_storage
    from app.crud.user import create_user_by_phone
    from app.utils.phone import normalize_phone

    phone = "+201666666666"
    await create_user_by_phone(db_session, phone, "Imported Neighbour")
    await db_session.commit()

    normalized = normalize_phone(phone)
    otp_storage[normalized] = {"otp": "123456", "expires_at": time.time() + 600}

    reset = await async_client.post(
        "/api/auth/reset-password-phone",
        json={
            "phone": phone,
            "otp_code": "123456",
            "new_password": "newpass1",
        },
    )
    assert reset.status_code == 200

    login = await async_client.post(
        "/api/auth/login",
        json={"email": phone, "password": "newpass1"},
    )
    assert login.status_code == 200
    assert "access_token" in login.json()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_phone_otp_confirms_chat_import_invite(async_client: AsyncClient, db_session):
    """Proving an imported phone should verify the compound, not leave a pending invite."""
    import time
    from app.api.auth import otp_storage
    from app.crud.user import create_user_by_phone
    from app.crud.user_compound_membership import ensure_pending_compound_membership
    from app.utils.phone import normalize_phone

    phone = "+201001234567"
    user = await create_user_by_phone(
        db_session, phone, "Imported Neighbour", creation_source="CHAT_IMPORT"
    )
    compound = Compound(name="Imported Compound", country="Egypt")
    db_session.add(compound)
    await db_session.flush()
    await ensure_pending_compound_membership(
        db_session, user.id, compound.id, source="CHAT_IMPORT"
    )
    await db_session.commit()

    normalized = normalize_phone(phone)
    otp_storage[normalized] = {"otp": "654321", "expires_at": time.time() + 600}

    verify = await async_client.post(
        "/api/auth/verify",
        json={"phone": phone, "otp_code": "654321"},
    )
    assert verify.status_code == 200
    payload = verify.json()["user"]
    assert payload["phone_verified"] is True
    assert payload["status"] == "APPROVED"
    assert payload["compound_id"] == compound.id
    assert payload["is_verified_for_current_compound"] is True
    assert payload["verification_status"] == "APPROVED"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_phone_otp_matches_uk_number_misimported_as_egypt(
    async_client: AsyncClient, db_session
):
    """UK 07… used to be stored as +20; OTP with +44 must still open that compound."""
    import time
    from app.api.auth import otp_storage
    from app.crud.user_compound_membership import ensure_pending_compound_membership
    from app.models.enums import UserStatus
    from app.models.user import User

    imported = User(
        name="Mohamed",
        email="phone_207539673391@hoodna.local",
        phone="207539673391",
        password_hash="",
        status=UserStatus.PENDING_VERIFICATION,
        phone_verified=True,
        email_verified=True,
        creation_source="CHAT_IMPORT",
    )
    db_session.add(imported)
    await db_session.flush()
    compound = Compound(name="UK Import Compound", country="Egypt")
    db_session.add(compound)
    await db_session.flush()
    await ensure_pending_compound_membership(
        db_session, imported.id, compound.id, source="CHAT_IMPORT"
    )
    await db_session.commit()

    otp_storage["447539673391"] = {"otp": "111222", "expires_at": time.time() + 600}
    verify = await async_client.post(
        "/api/auth/verify",
        json={"phone": "+447539673391", "otp_code": "111222"},
    )
    assert verify.status_code == 200
    payload = verify.json()["user"]
    assert payload["id"] == imported.id
    assert payload["compound_id"] == compound.id
    assert payload["is_verified_for_current_compound"] is True
    assert payload["status"] == "APPROVED"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_me_sets_compound_from_verified_membership(async_client: AsyncClient, db_session):
    """Verified membership with a null users.compound_id must still route into the compound."""
    from app.core.security import create_access_token
    from app.models.user_compound_membership import UserCompoundMembership

    compound = Compound(name="Hydrate Compound", country="Egypt")
    db_session.add(compound)
    await db_session.flush()
    user = User(
        name="Mohamed",
        email="mohamed-hydrate@hoodna.local",
        phone="447539673391",
        password_hash="",
        role=UserRole.USER,
        status=UserStatus.PENDING_VERIFICATION,
        phone_verified=True,
        email_verified=True,
        compound_id=None,
    )
    db_session.add(user)
    await db_session.flush()
    db_session.add(
        UserCompoundMembership(
            user_id=user.id,
            compound_id=compound.id,
            verification_status="VERIFIED",
            verification_source="CHAT_IMPORT",
        )
    )
    await db_session.commit()

    token = create_access_token(data={"sub": user.id})
    me = await async_client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert me.status_code == 200
    payload = me.json()
    assert payload["compound_id"] == compound.id
    assert payload["is_verified_for_current_compound"] is True
    assert payload["status"] == "APPROVED"
    assert compound.id in (payload.get("verified_compound_ids") or [])


@pytest.mark.asyncio
@pytest.mark.unit
async def test_me_adopts_verified_membership_from_phone_twin(
    async_client: AsyncClient, db_session
):
    from app.core.security import create_access_token
    from app.models.user_compound_membership import UserCompoundMembership

    compound = Compound(name="Twin Compound", country="Egypt")
    db_session.add(compound)
    await db_session.flush()
    imported = User(
        name="Imported Mohamed",
        email="phone_207539673391@hoodna.local",
        phone="207539673391",
        password_hash="",
        role=UserRole.USER,
        status=UserStatus.APPROVED,
        phone_verified=True,
        email_verified=True,
        compound_id=compound.id,
        creation_source="CHAT_IMPORT",
    )
    session_user = User(
        name="Mohamed",
        email="phone_447539673391@hoodna.local",
        phone="447539673391",
        password_hash="",
        role=UserRole.USER,
        status=UserStatus.PENDING_VERIFICATION,
        phone_verified=True,
        email_verified=True,
        compound_id=None,
    )
    db_session.add_all([imported, session_user])
    await db_session.flush()
    db_session.add(
        UserCompoundMembership(
            user_id=imported.id,
            compound_id=compound.id,
            verification_status="VERIFIED",
            verification_source="CHAT_IMPORT",
        )
    )
    await db_session.commit()

    token = create_access_token(data={"sub": session_user.id})
    me = await async_client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert me.status_code == 200
    payload = me.json()
    assert payload["id"] == session_user.id
    assert payload["compound_id"] == compound.id
    assert payload["is_verified_for_current_compound"] is True
    assert payload["status"] == "APPROVED"
