import os

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from authlib.integrations.httpx_client import AsyncOAuth2Client
from itsdangerous import BadSignature, SignatureExpired, TimestampSigner

from database import get_user_by_id, upsert_user

router = APIRouter()

GOOGLE_CLIENT_ID = os.environ["GOOGLE_CLIENT_ID"]
GOOGLE_CLIENT_SECRET = os.environ["GOOGLE_CLIENT_SECRET"]
SESSION_SECRET = os.environ["SESSION_SECRET"]

GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

_signer = TimestampSigner(SESSION_SECRET)

COOKIE_NAME = "session"
COOKIE_MAX_AGE = 60 * 60 * 24 * 30  # 30 days


def _make_cookie_value(user_id: int) -> str:
    return _signer.sign(str(user_id)).decode()


def get_current_user(request: Request) -> dict | None:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    try:
        user_id = int(_signer.unsign(token, max_age=COOKIE_MAX_AGE).decode())
        return get_user_by_id(user_id)
    except (BadSignature, SignatureExpired, ValueError):
        return None


def _callback_uri(request: Request) -> str:
    return str(request.base_url).rstrip("/") + "/api/auth/callback"


@router.get("/api/auth/login")
async def login(request: Request):
    client = AsyncOAuth2Client(
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        scope="openid email profile",
    )
    uri, state = client.create_authorization_url(
        GOOGLE_AUTHORIZE_URL,
        redirect_uri=_callback_uri(request),
    )
    response = RedirectResponse(url=uri)
    response.set_cookie("oauth_state", state, httponly=True, samesite="lax", max_age=300)
    return response


@router.get("/api/auth/callback")
async def callback(request: Request, code: str, state: str):
    stored_state = request.cookies.get("oauth_state", "")
    client = AsyncOAuth2Client(
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        state=stored_state,
    )
    await client.fetch_token(
        GOOGLE_TOKEN_URL,
        code=code,
        redirect_uri=_callback_uri(request),
    )
    resp = await client.get(GOOGLE_USERINFO_URL)
    info = resp.json()

    user = upsert_user(
        google_id=info["sub"],
        email=info["email"],
        name=info.get("name", ""),
    )

    response = RedirectResponse(url="/")
    response.set_cookie(
        COOKIE_NAME,
        _make_cookie_value(user["id"]),
        httponly=True,
        samesite="lax",
        max_age=COOKIE_MAX_AGE,
    )
    response.delete_cookie("oauth_state")
    return response


@router.get("/api/auth/me")
async def me(request: Request):
    user = get_current_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "credits": user["credits"],
    }


@router.get("/api/auth/logout")
async def logout():
    response = RedirectResponse(url="/")
    response.delete_cookie(COOKIE_NAME)
    return response
