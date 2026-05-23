import pytest
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport
from main import app

# Build a valid admin cookie for tests
def _make_admin_cookie() -> str:
    import os
    from itsdangerous import TimestampSigner
    signer = TimestampSigner(os.environ["SESSION_SECRET"], salt="admin")
    return signer.sign("admin").decode()


async def test_stats_requires_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/admin/stats")
    assert response.status_code == 401


async def test_login_wrong_secret():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/admin/login", json={"secret": "wrong"})
    assert response.status_code == 401


async def test_login_correct_secret_sets_cookie():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/admin/login", json={"secret": "test-admin-secret"})
    assert response.status_code == 200
    assert "admin_session" in response.cookies


async def test_stats_with_valid_cookie():
    cookie = _make_admin_cookie()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        client.cookies.set("admin_session", cookie)
        response = await client.get("/api/admin/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_users" in data
    assert "total_revenue" in data
    assert "paying_users" in data
    assert "signups_today" in data


async def test_users_with_valid_cookie():
    cookie = _make_admin_cookie()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        client.cookies.set("admin_session", cookie)
        response = await client.get("/api/admin/users")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data


async def test_payments_with_valid_cookie():
    cookie = _make_admin_cookie()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        client.cookies.set("admin_session", cookie)
        response = await client.get("/api/admin/payments")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data


async def test_set_credits_updates_user():
    from database import upsert_user
    user = upsert_user("g1", "a@example.com", "Alice")
    cookie = _make_admin_cookie()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        client.cookies.set("admin_session", cookie)
        response = await client.post(
            f"/api/admin/users/{user['id']}/credits",
            json={"credits": 99},
        )
    assert response.status_code == 200
    assert response.json()["credits"] == 99


async def test_set_credits_404_for_missing_user():
    cookie = _make_admin_cookie()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        client.cookies.set("admin_session", cookie)
        response = await client.post(
            "/api/admin/users/9999/credits",
            json={"credits": 10},
        )
    assert response.status_code == 404
