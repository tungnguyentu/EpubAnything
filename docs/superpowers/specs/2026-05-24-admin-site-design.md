# Admin Site Design

**Date:** 2026-05-24
**Feature:** feat-008 — Admin site

## Overview

A password-protected `/admin` section in the existing Next.js app. Lets the operator view system stats, manage user credits, and review payment history. Protected by a single `ADMIN_SECRET` env var — no separate user accounts needed.

## Authentication

- `GET /admin/login` renders a password form.
- Form submits to `POST /api/admin/login` with `{ secret: string }`.
- Backend compares against `ADMIN_SECRET` env var. On match, issues a signed `admin_session` cookie via `itsdangerous` (same signer already used for user sessions), 24-hour expiry.
- All `/api/admin/*` endpoints share a single `require_admin(request)` FastAPI dependency that reads and verifies the cookie. Returns 401 if missing or invalid.
- `frontend/app/admin/layout.tsx` calls `/api/admin/stats` on mount; if it gets a 401 it redirects to `/admin/login`. No admin content renders before auth passes.

## Database Changes

**New table — `transactions`:**

```sql
CREATE TABLE IF NOT EXISTS transactions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id),
    amount_usd       REAL NOT NULL,
    credits_purchased INTEGER NOT NULL,
    paypal_order_id  TEXT NOT NULL,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**New `database.py` functions:**
- `record_transaction(user_id, amount_usd, credits_purchased, paypal_order_id)` — insert row
- `list_transactions(page, page_size)` — paginated, newest first
- `get_stats()` — returns `{ total_users, total_revenue, paying_users, signups_today }`
- `list_users(page, page_size)` — paginated, newest first
- `set_user_credits(user_id, credits)` — manual credit override

`payments.py` calls `record_transaction()` immediately after a successful PayPal capture.

## Backend — `backend/admin.py`

New FastAPI router mounted at `/api/admin`. All routes depend on `require_admin`.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/admin/login` | Verify secret, set cookie |
| `GET` | `/api/admin/stats` | `{ total_users, total_revenue, paying_users, signups_today }` |
| `GET` | `/api/admin/users?page=1` | Paginated users `{ items, total, page }` |
| `POST` | `/api/admin/users/{id}/credits` | Body `{ credits: int }` — set credits |
| `GET` | `/api/admin/payments?page=1` | Paginated transactions `{ items, total, page }` |

Page size: 20 rows. Pagination is offset-based (simple, fits SQLite scale).

## Frontend — `frontend/app/admin/`

```
app/admin/
  layout.tsx         — sidebar shell + auth guard
  login/page.tsx     — password form
  dashboard/page.tsx — 4 stat cards + recent users table (10 rows)
  users/page.tsx     — full paginated users table + inline credit edit
  payments/page.tsx  — read-only paginated transaction log
```

**Sidebar links:** Dashboard · Users · Payments · ← Back to site

**Stat cards (dashboard):** Total Users · Total Revenue · Paying Users · Signups Today

**Users page:** columns — Email, Name, Credits (editable inline), Joined. Credit edit: click the value → number input → Save button → `POST /api/admin/users/{id}/credits`.

**Payments page:** columns — Date, Email, Amount, Credits, PayPal Order ID.

**Pagination:** Users and Payments pages use simple Prev / Next buttons. No page numbers or jump-to-page.

**Styling:** Reuse existing CSS custom properties (`--fg`, `--bg-raised`, `--accent`, etc.). No new design tokens. Sidebar background `#111`, active item highlighted with `--bg-raised`.

## Error Handling

- `/api/admin/login` wrong secret → 401, show "Invalid password" in form.
- Any admin API 401 → frontend redirects to `/admin/login`.
- Credit edit saves optimistically; reverts on API error with an inline error message.

## Testing

- Unit tests for all new `database.py` functions (mock SQLite).
- Tests for `require_admin` dependency (valid cookie, missing cookie, tampered cookie).
- Tests for each admin endpoint (happy path + 401 without cookie).
- No frontend tests — manual verification sufficient for an internal-only tool.

## Out of Scope

- Bulk credit operations.
- Admin activity log / audit trail.
- Email notifications.
