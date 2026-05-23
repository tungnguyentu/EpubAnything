import os

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from itsdangerous import BadSignature, SignatureExpired, TimestampSigner
from pydantic import BaseModel

from database import get_stats, list_transactions, list_users, set_user_credits

router = APIRouter()

SESSION_SECRET = os.environ["SESSION_SECRET"]
ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "")
ADMIN_COOKIE_NAME = "admin_session"
ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24  # 24 hours

_signer = TimestampSigner(SESSION_SECRET, salt="admin")


def require_admin(request: Request) -> None:
    token = request.cookies.get(ADMIN_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        _signer.unsign(token, max_age=ADMIN_COOKIE_MAX_AGE)
    except (BadSignature, SignatureExpired):
        raise HTTPException(status_code=401, detail="Not authenticated")


class LoginRequest(BaseModel):
    secret: str


class SetCreditsRequest(BaseModel):
    credits: int


@router.post("/api/admin/login")
async def admin_login(body: LoginRequest):
    if not ADMIN_SECRET or body.secret != ADMIN_SECRET:
        raise HTTPException(status_code=401, detail="Invalid password")
    token = _signer.sign("admin").decode()
    response = JSONResponse({"ok": True})
    response.set_cookie(
        ADMIN_COOKIE_NAME,
        token,
        httponly=True,
        samesite="lax",
        max_age=ADMIN_COOKIE_MAX_AGE,
    )
    return response


@router.get("/api/admin/stats")
async def admin_stats(_: None = Depends(require_admin)):
    return get_stats()


@router.get("/api/admin/users")
async def admin_users(page: int = 1, _: None = Depends(require_admin)):
    return list_users(page=page)


@router.post("/api/admin/users/{user_id}/credits")
async def admin_set_credits(
    user_id: int, body: SetCreditsRequest, _: None = Depends(require_admin)
):
    user = set_user_credits(user_id, body.credits)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/api/admin/payments")
async def admin_payments(page: int = 1, _: None = Depends(require_admin)):
    return list_transactions(page=page)
