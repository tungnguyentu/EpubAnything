import pytest
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport
from main import app


async def test_me_returns_401_without_cookie():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/auth/me")
    assert response.status_code == 401


async def test_me_returns_user_with_valid_cookie():
    fake_user = {"id": 1, "email": "a@example.com", "name": "Alice", "credits": 5}
    with patch("auth.get_current_user", return_value=fake_user):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/auth/me")
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "a@example.com"
    assert body["credits"] == 5


async def test_me_returns_401_with_tampered_cookie():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        client.cookies.set("session", "tampered.invalid.value")
        response = await client.get("/api/auth/me")
    assert response.status_code == 401


async def test_logout_redirects_and_clears_cookie():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
    ) as client:
        response = await client.get("/api/auth/logout")
    assert response.status_code in (302, 307)
    set_cookie = response.headers.get("set-cookie", "")
    assert "session" in set_cookie
