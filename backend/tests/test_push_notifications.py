"""Tests for the push notification pipeline.

These cover the parts that silently break in production: preference gating,
token reassignment between accounts, dead-token pruning, and the guarantee that
a push failure never breaks the action that produced the notification.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.push_token import PushToken

VALID_TOKEN = "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]"


async def _signed_in_user(db_session, email: str = "device@example.com"):
    """Create an approved user and return (user, auth headers)."""
    from app.core.security import create_access_token, get_password_hash
    from app.models.enums import UserRole, UserStatus
    from app.models.user import User

    user = User(
        name="Device Owner",
        email=email,
        password_hash=get_password_hash("good-password-1"),
        role=UserRole.RESIDENT,
        status=UserStatus.APPROVED,
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.commit()
    token = create_access_token(data={"sub": user.id})
    return user, {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
@pytest.mark.unit
async def test_register_push_token_requires_authentication(async_client: AsyncClient):
    response = await async_client.post(
        "/api/notifications/push-tokens", json={"token": VALID_TOKEN}
    )
    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.unit
async def test_register_push_token_rejects_non_expo_tokens(
    async_client: AsyncClient, db_session
):
    _, auth_headers = await _signed_in_user(db_session, "reject@example.com")
    for bad in ["not-a-token", "ExponentPushToken[unterminated", "", "x" * 300]:
        response = await async_client.post(
            "/api/notifications/push-tokens",
            json={"token": bad},
            headers=auth_headers,
        )
        assert response.status_code == 422, f"{bad!r} should be rejected"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_registering_the_same_token_twice_does_not_duplicate(
    async_client: AsyncClient, db_session
):
    """A duplicate row would deliver every notification twice."""
    _, auth_headers = await _signed_in_user(db_session, "dupe@example.com")
    for _ in range(3):
        response = await async_client.post(
            "/api/notifications/push-tokens",
            json={"token": VALID_TOKEN, "platform": "ios"},
            headers=auth_headers,
        )
        assert response.status_code == 204

    rows = await db_session.execute(
        select(PushToken).where(PushToken.token == VALID_TOKEN)
    )
    assert len(list(rows.scalars().all())) == 1


@pytest.mark.asyncio
@pytest.mark.unit
async def test_token_is_reassigned_when_a_new_account_signs_in_on_the_device(
    db_session,
):
    """Otherwise the previous owner keeps receiving the new owner's alerts."""
    from app.core.security import get_password_hash
    from app.models.enums import UserRole, UserStatus
    from app.models.user import User
    from app.services.push import register_push_token

    users = []
    for index in (1, 2):
        user = User(
            name=f"Device Owner {index}",
            email=f"owner{index}@example.com",
            password_hash=get_password_hash("good-password-1"),
            role=UserRole.RESIDENT,
            status=UserStatus.APPROVED,
        )
        db_session.add(user)
        users.append(user)
    await db_session.flush()

    await register_push_token(db_session, users[0].id, VALID_TOKEN)
    await register_push_token(db_session, users[1].id, VALID_TOKEN)

    rows = await db_session.execute(
        select(PushToken).where(PushToken.token == VALID_TOKEN)
    )
    tokens = list(rows.scalars().all())
    assert len(tokens) == 1
    assert tokens[0].user_id == users[1].id


@pytest.mark.asyncio
@pytest.mark.unit
async def test_unregister_cannot_remove_another_users_token(db_session):
    """A guessed token must not let one user silence someone else's phone."""
    from app.core.security import get_password_hash
    from app.models.enums import UserRole, UserStatus
    from app.models.user import User
    from app.services.push import register_push_token, unregister_push_token

    owner = User(
        name="Owner",
        email="owner@example.com",
        password_hash=get_password_hash("good-password-1"),
        role=UserRole.RESIDENT,
        status=UserStatus.APPROVED,
    )
    attacker = User(
        name="Attacker",
        email="attacker@example.com",
        password_hash=get_password_hash("good-password-1"),
        role=UserRole.RESIDENT,
        status=UserStatus.APPROVED,
    )
    db_session.add_all([owner, attacker])
    await db_session.flush()

    await register_push_token(db_session, owner.id, VALID_TOKEN)

    assert await unregister_push_token(db_session, attacker.id, VALID_TOKEN) is False
    assert await unregister_push_token(db_session, owner.id, VALID_TOKEN) is True


@pytest.mark.asyncio
@pytest.mark.unit
async def test_push_respects_the_user_preference(db_session, monkeypatch):
    from app.core.security import get_password_hash
    from app.models.enums import UserRole, UserStatus
    from app.models.launch_accounts import UserPreference
    from app.models.user import User
    from app.services import push as push_service

    user = User(
        name="Opted Out",
        email="optout@example.com",
        password_hash=get_password_hash("good-password-1"),
        role=UserRole.RESIDENT,
        status=UserStatus.APPROVED,
    )
    db_session.add(user)
    await db_session.flush()

    await push_service.register_push_token(db_session, user.id, VALID_TOKEN)
    db_session.add(UserPreference(user_id=user.id, push_notifications=False))
    await db_session.flush()

    sent: list = []

    class _ShouldNotBeCalled:
        def __init__(self, *args, **kwargs):
            sent.append(True)

    monkeypatch.setattr(push_service.httpx, "AsyncClient", _ShouldNotBeCalled)

    accepted = await push_service.send_push_to_users(
        db_session, [user.id], title="Hi", body="There"
    )
    assert accepted == 0
    assert sent == [], "no HTTP call should be made for an opted-out user"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_dead_tokens_are_pruned_and_send_never_raises(db_session, monkeypatch):
    from app.core.security import get_password_hash
    from app.models.enums import UserRole, UserStatus
    from app.models.user import User
    from app.services import push as push_service

    user = User(
        name="Stale Device",
        email="stale@example.com",
        password_hash=get_password_hash("good-password-1"),
        role=UserRole.RESIDENT,
        status=UserStatus.APPROVED,
    )
    db_session.add(user)
    await db_session.flush()
    await push_service.register_push_token(db_session, user.id, VALID_TOKEN)

    class _Response:
        status_code = 200

        @staticmethod
        def json():
            return {
                "data": [
                    {
                        "status": "error",
                        "details": {"error": "DeviceNotRegistered"},
                    }
                ]
            }

    class _Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, *args, **kwargs):
            return _Response()

    monkeypatch.setattr(push_service.httpx, "AsyncClient", lambda **kw: _Client())

    accepted = await push_service.send_push_to_users(
        db_session, [user.id], title="Hi", body="There"
    )
    assert accepted == 0

    rows = await db_session.execute(
        select(PushToken).where(PushToken.token == VALID_TOKEN)
    )
    assert list(rows.scalars().all()) == [], "dead token should have been pruned"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_notification_creation_survives_a_push_outage(db_session, monkeypatch):
    """The in-app notification is the source of truth; a push failure is not fatal."""
    from app.core.security import get_password_hash
    from app.crud.notification import create_notification
    from app.models.enums import NotificationType, UserRole, UserStatus
    from app.models.user import User
    from app.schemas.notification import NotificationCreate
    from app.services import push as push_service

    user = User(
        name="Recipient",
        email="recipient@example.com",
        password_hash=get_password_hash("good-password-1"),
        role=UserRole.RESIDENT,
        status=UserStatus.APPROVED,
    )
    db_session.add(user)
    await db_session.flush()
    await push_service.register_push_token(db_session, user.id, VALID_TOKEN)

    def _explode(**kwargs):
        raise RuntimeError("expo is down")

    monkeypatch.setattr(push_service.httpx, "AsyncClient", _explode)

    notification = await create_notification(
        db_session,
        NotificationCreate(
            user_id=user.id,
            type=NotificationType.VERIFICATION_APPROVED,
            title="You're verified",
            message="Welcome to the neighbourhood.",
        ),
    )
    assert notification.id is not None
