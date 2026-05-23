# Payments & Credits Feature Design

## Goal

Gate multi-page course EPUB conversion behind a credit system. Single-page conversion stays free and requires no account. Users buy 10 credits for $3 via PayPal; each multi-page conversion costs 1 credit.

## Architecture

Everything lives in the FastAPI backend. Google OAuth via `authlib`, sessions via a signed cookie (`itsdangerous`), SQLite for user + credit storage, PayPal Orders API v2 for payments. Next.js stays a pure frontend — no Next.js API routes added.

```
User (no account)  → /api/convert          → single-page EPUB, always works
User (no account)  → /api/convert-site     → 401 Unauthorized
User (logged in, credits=0) → /api/convert-site → 402 Payment Required
User (logged in, credits≥1) → /api/convert-site → stream progress, deduct 1 on done
```

## Database

Single new table in `backend/epubanything.db` (SQLite, created on startup):

```sql
CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id   TEXT UNIQUE NOT NULL,
    email       TEXT NOT NULL,
    name        TEXT,
    credits     INTEGER NOT NULL DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

No ORM. Raw `sqlite3` in a new `backend/database.py` module.

### `backend/database.py` functions

| Function | Signature | Purpose |
|----------|-----------|---------|
| `init_db()` | `() -> None` | Create table if not exists; called at app startup |
| `get_user_by_google_id` | `(google_id: str) -> dict \| None` | Look up user |
| `upsert_user` | `(google_id, email, name) -> dict` | Insert or update name/email, return user row |
| `get_credits` | `(user_id: int) -> int` | Return current balance |
| `add_credits` | `(user_id: int, amount: int) -> int` | Add credits, return new balance |
| `deduct_credit` | `(user_id: int) -> bool` | Atomically deduct 1 if balance ≥ 1; return True if deducted |

## Auth

**New file: `backend/auth.py`** — FastAPI router mounted at `/api/auth`.

### Endpoints

| Method | Path | Behavior |
|--------|------|----------|
| `GET` | `/api/auth/login` | Redirect to Google OAuth consent URL |
| `GET` | `/api/auth/callback` | Exchange code → upsert user → set session cookie → redirect to `/` |
| `GET` | `/api/auth/me` | Return `{id, email, name, credits}` or 401 |
| `GET` | `/api/auth/logout` | Clear session cookie → redirect to `/` |

### Session cookie

- Name: `session`
- Value: `itsdangerous.TimestampSigner(SESSION_SECRET).sign(str(user_id))`
- `HttpOnly=True`, `SameSite=Lax`, `Max-Age=2592000` (30 days)
- Helper `get_current_user(request) -> dict | None` reads and verifies the cookie; returns `None` if missing or tampered.

### New env vars

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SESSION_SECRET=          # long random string, e.g. 64 hex chars
```

Google OAuth callback URL to register: `https://yourdomain.com/api/auth/callback`

## Payments

**New file: `backend/payments.py`** — FastAPI router mounted at `/api`.

### Endpoints

| Method | Path | Behavior |
|--------|------|----------|
| `POST` | `/api/checkout` | Require auth cookie → create PayPal order ($3.00 USD) → return `{orderId}` |
| `POST` | `/api/checkout/capture` | Require auth cookie → capture PayPal order → verify COMPLETED → `add_credits(user_id, 10)` → return `{credits}` |

No webhook endpoint needed — capture is synchronous and confirms payment in the response.

### PayPal integration

Uses PayPal Orders API v2 directly via `httpx` (no SDK dependency):

- **Create order:** `POST https://api-m.paypal.com/v2/checkout/orders` with amount `3.00 USD`, `intent: CAPTURE`
- **Capture order:** `POST https://api-m.paypal.com/v2/checkout/orders/{id}/capture`
- Auth: OAuth2 client credentials (`PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET`) → Bearer token fetched once and cached in a module-level variable with its expiry timestamp; refreshed automatically when expired

### New env vars

```
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox          # change to live for production
NEXT_PUBLIC_PAYPAL_CLIENT_ID= # exposed to frontend for JS SDK
```

## Credit Gate

`/api/convert-site` in `backend/main.py` gains two checks at the top:

```python
user = get_current_user(request)
if user is None:
    raise HTTPException(status_code=401, detail="Sign in to convert course sites")
if user["credits"] < 1:
    raise HTTPException(status_code=402, detail="No credits remaining")
```

Credit deduction happens inside `_stream_site_conversion` immediately before yielding the `done` event — users only pay for successful conversions. `user_id` is passed as a new parameter to the generator:

```python
# /api/convert-site passes user["id"] to the generator
return StreamingResponse(
    _stream_site_conversion(req.pages, req.siteTitle, user["id"]),
    ...
)

# inside _stream_site_conversion(pages, site_title, user_id):
# just before yielding done
if not deduct_credit(user_id):
    yield f"data: {json.dumps({'type': 'error', 'detail': 'Credit deduction failed'})}\n\n"
    return
yield f"data: {json.dumps({'type': 'done', ...})}\n\n"
```

`/api/convert` (single-page) is unchanged — no auth, no credits.

## Frontend

### New component: `frontend/components/auth-bar.tsx`

Rendered top-right on the page. Calls `GET /api/auth/me` on mount.

- **Logged out:** "Sign in with Google" link → navigates to `/api/auth/login`
- **Logged in:** Google name + "N credits" badge + "Buy Credits" button (renders PayPal buttons) + "Sign out" link

### PayPal button rendering

When user clicks "Buy Credits":
1. Load PayPal JS SDK (`https://www.paypal.com/sdk/js?client-id=NEXT_PUBLIC_PAYPAL_CLIENT_ID&currency=USD`)
2. Render PayPal buttons in a small modal/dropdown
3. `createOrder`: POST `/api/checkout` → return `orderId`
4. `onApprove`: POST `/api/checkout/capture` with `{orderId}` → update credit count in UI

### `frontend/components/url-form.tsx` changes

`handleConfirmSite` gains two early-exit cases before the fetch:

```ts
if (!user) {
  // show inline "Sign in to convert course sites" message
  return
}
if (user.credits < 1) {
  // show inline "Buy credits to convert course sites" message
  return
}
```

The `user` state is passed down from `page.tsx` (fetched via `/api/auth/me`).

### `/?credits=added` redirect

After PayPal capture, no redirect needed — the capture response returns the new balance and the UI updates in place.

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `backend/database.py` | Create | SQLite init + all user/credit helpers |
| `backend/auth.py` | Create | Google OAuth router + session cookie helpers |
| `backend/payments.py` | Create | PayPal checkout + capture router |
| `backend/main.py` | Modify | Include auth/payments routers, init_db on startup, gate convert-site |
| `backend/requirements.txt` | Modify | Add `authlib`, `itsdangerous` |
| `backend/tests/test_auth.py` | Create | Tests for session cookie, /api/auth/me |
| `backend/tests/test_payments.py` | Create | Tests for checkout + capture (mock PayPal) |
| `backend/tests/test_database.py` | Create | Unit tests for all database helpers |
| `frontend/components/auth-bar.tsx` | Create | Auth state + credits display + PayPal button |
| `frontend/components/url-form.tsx` | Modify | Pass user prop, add pre-conversion auth/credit checks |
| `frontend/app/page.tsx` | Modify | Fetch /api/auth/me, pass user to UrlForm + AuthBar |
| `frontend/app/globals.css` | Modify | Auth bar + credits badge styles |

## Environment Variables Summary

```env
# Auth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SESSION_SECRET=

# Payments
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox

# Frontend (public)
NEXT_PUBLIC_PAYPAL_CLIENT_ID=
```

## Testing

- `test_database.py`: upsert_user creates/updates correctly; deduct_credit is atomic (no deduction when balance=0); add_credits returns new balance.
- `test_auth.py`: `/api/auth/me` returns 401 with no cookie; returns user+credits with valid cookie; tampered cookie returns 401.
- `test_payments.py`: `/api/checkout` requires auth (401 without cookie); `/api/checkout/capture` calls `add_credits` when PayPal returns COMPLETED; does not add credits when PayPal returns non-COMPLETED.
- `test_api.py`: `/api/convert-site` returns 401 with no cookie; returns 402 with valid cookie + 0 credits; streams normally with valid cookie + credits ≥ 1.

## Out of Scope

- Refunds
- Credit expiry
- Multiple pack sizes (only 10-for-$3)
- Email receipts
- Admin dashboard
