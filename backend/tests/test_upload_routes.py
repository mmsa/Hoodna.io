"""Regression tests for the /api/uploads route surface.

The local-storage file server is registered as `GET /api/uploads/{file_path:path}`.
Starlette matches routes in registration order, so if that greedy route is ever
registered before the specific upload routes it silently swallows them and they
answer "File not found" instead of doing their job. That failure is invisible in
unit tests that call the functions directly, hence these route-level tests.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.parametrize(
    "path",
    [
        "/api/uploads/download?file_url=https://example.com/verification/doc.pdf",
        "/api/uploads/signed-url?file_url=https://example.com/listings/photo.png",
    ],
)
async def test_specific_upload_routes_are_not_shadowed_by_the_file_server(
    async_client: AsyncClient, path: str
):
    """These must reach their handler and demand credentials, not 404."""
    response = await async_client.get(path)

    assert response.status_code == 401, (
        f"{path} returned {response.status_code}; a 404 here means the greedy "
        "/api/uploads/{file_path:path} route is shadowing it again."
    )
    assert "not found" not in response.json()["detail"].casefold()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_presign_requires_authentication(async_client: AsyncClient):
    response = await async_client.post(
        "/api/uploads/presign?file_name=a.png&file_type=image/png"
    )
    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.unit
async def test_upload_routes_are_registered_before_the_catch_all():
    """Assert the ordering directly so the intent is documented in one place."""
    from app.main import app

    paths = [getattr(route, "path", "") for route in app.routes]
    if "/api/uploads/{file_path:path}" not in paths:
        pytest.skip("local storage file server not registered in this configuration")

    catch_all = paths.index("/api/uploads/{file_path:path}")
    for specific in ("/api/uploads/download", "/api/uploads/signed-url"):
        assert paths.index(specific) < catch_all, (
            f"{specific} must be registered before the catch-all route"
        )
