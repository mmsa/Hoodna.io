"""
Unit tests for authentication endpoints.
"""
import pytest
from httpx import AsyncClient
from app.models.user import User
from app.models.enums import UserRole, UserStatus
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
    user_data = {
        "name": "Test User",
        "email": "login@example.com",
        "phone": "+201234567890",
        "password_hash": get_password_hash("password123"),
        "role": UserRole.USER,
        "status": UserStatus.PENDING,
    }
    await create_user(db_session, **user_data)
    
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
    from app.crud.user import create_user
    user_data = {
        "name": "Test User",
        "email": "me@example.com",
        "phone": "+201234567890",
        "password_hash": get_password_hash("password123"),
        "role": UserRole.USER,
        "status": UserStatus.APPROVED,
    }
    user = await create_user(db_session, **user_data)
    
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
async def test_get_current_user_unauthenticated(async_client: AsyncClient):
    """Test getting current user info without authentication."""
    response = await async_client.get("/api/auth/me")
    assert response.status_code == 401

