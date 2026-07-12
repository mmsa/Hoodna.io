"""
Pytest configuration and fixtures for backend tests.
"""
import pytest
import asyncio
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.core.config import settings


# Test database URL (use in-memory SQLite for tests)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# Create test engine
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

# Create test session factory
TestSessionLocal = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


@pytest.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Create a fresh database session for each test.
    """
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with TestSessionLocal() as session:
        yield session
    
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(scope="function")
def override_get_db(db_session: AsyncSession):
    """
    Override the get_db dependency to use test database.
    """
    async def _get_db():
        yield db_session
    
    return _get_db


@pytest.fixture(scope="function")
def client(override_get_db):
    """
    Create a test client for the FastAPI app.
    """
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
async def async_client(override_get_db) -> AsyncGenerator[AsyncClient, None]:
    """
    Create an async test client for the FastAPI app.
    """
    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
async def test_user_data():
    """
    Sample user data for testing.
    """
    return {
        "name": "Test User",
        "email": "test@example.com",
        "phone": "+201234567890",
        "password": "testpassword123",
    }


@pytest.fixture(scope="function")
async def admin_user_data():
    """
    Sample admin user data for testing.
    """
    return {
        "name": "Admin User",
        "email": "admin@example.com",
        "phone": "+201234567891",
        "password": "adminpassword123",
        "role": "ADMIN",
    }

