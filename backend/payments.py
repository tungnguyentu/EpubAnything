import os
import time

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from auth import get_current_user
from database import add_credits, record_transaction

router = APIRouter()

PAYPAL_CLIENT_ID = os.environ["PAYPAL_CLIENT_ID"]
PAYPAL_CLIENT_SECRET = os.environ["PAYPAL_CLIENT_SECRET"]
PAYPAL_MODE = os.environ.get("PAYPAL_MODE", "sandbox")

PAYPAL_BASE = (
    "https://api-m.sandbox.paypal.com"
    if PAYPAL_MODE == "sandbox"
    else "https://api-m.paypal.com"
)

PACK_CREDITS = 10
PACK_AMOUNT = "3.00"

# Avoid fetching a new OAuth token on every request
_token_cache: dict = {"token": None, "expires_at": 0.0}


async def _get_paypal_token() -> str:
    now = time.time()
    if _token_cache["token"] and _token_cache["expires_at"] > now + 60:
        return _token_cache["token"]  # type: ignore[return-value]

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{PAYPAL_BASE}/v1/oauth2/token",
            data={"grant_type": "client_credentials"},
            auth=(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET),
        )
        resp.raise_for_status()
        data = resp.json()
        _token_cache["token"] = data["access_token"]
        _token_cache["expires_at"] = now + data["expires_in"]
        return data["access_token"]


async def _create_order() -> str:
    token = await _get_paypal_token()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{PAYPAL_BASE}/v2/checkout/orders",
            json={
                "intent": "CAPTURE",
                "purchase_units": [
                    {
                        "amount": {"currency_code": "USD", "value": PACK_AMOUNT},
                        "description": f"{PACK_CREDITS} EpubAnything credits",
                    }
                ],
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        return resp.json()["id"]


async def _capture_order(order_id: str) -> bool:
    token = await _get_paypal_token()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{PAYPAL_BASE}/v2/checkout/orders/{order_id}/capture",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={},
        )
        resp.raise_for_status()
        return resp.json().get("status") == "COMPLETED"


class CaptureRequest(BaseModel):
    orderId: str


@router.post("/api/checkout")
async def checkout(request: Request):
    user = get_current_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    order_id = await _create_order()
    return {"orderId": order_id}


@router.post("/api/checkout/capture")
async def capture(body: CaptureRequest, request: Request):
    user = get_current_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    completed = await _capture_order(body.orderId)
    if not completed:
        raise HTTPException(status_code=400, detail="Payment not completed")
    new_balance = add_credits(user["id"], PACK_CREDITS)
    record_transaction(user["id"], float(PACK_AMOUNT), PACK_CREDITS, body.orderId)
    return {"credits": new_balance}
