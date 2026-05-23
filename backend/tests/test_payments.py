import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport
from main import app

FAKE_USER = {"id": 1, "email": "a@example.com", "name": "Alice", "credits": 0}


async def test_checkout_requires_auth():
    with patch("payments.get_current_user", return_value=None):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/checkout")
    assert response.status_code == 401


async def test_checkout_returns_order_id():
    with (
        patch("payments.get_current_user", return_value=FAKE_USER),
        patch("payments._create_order", new_callable=AsyncMock, return_value="ORDER123"),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/checkout")
    assert response.status_code == 200
    assert response.json()["orderId"] == "ORDER123"


async def test_capture_adds_credits_on_completed():
    with (
        patch("payments.get_current_user", return_value=FAKE_USER),
        patch("payments._capture_order", new_callable=AsyncMock, return_value=True),
        patch("payments.add_credits", return_value=10),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/checkout/capture", json={"orderId": "ORDER123"}
            )
    assert response.status_code == 200
    assert response.json()["credits"] == 10


async def test_capture_returns_400_when_not_completed():
    with (
        patch("payments.get_current_user", return_value=FAKE_USER),
        patch("payments._capture_order", new_callable=AsyncMock, return_value=False),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/checkout/capture", json={"orderId": "ORDER123"}
            )
    assert response.status_code == 400


async def test_capture_records_transaction():
    with (
        patch("payments.get_current_user", return_value={"id": 1, "email": "a@example.com", "name": "Alice", "credits": 0}),
        patch("payments._capture_order", new_callable=AsyncMock, return_value=True),
        patch("payments.add_credits", return_value=10),
        patch("payments.record_transaction") as mock_record,
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/checkout/capture", json={"orderId": "ORDER-XYZ"}
            )
    assert response.status_code == 200
    mock_record.assert_called_once_with(1, 3.00, 10, "ORDER-XYZ")
