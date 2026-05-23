# Admin Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a password-protected `/admin` section to the Next.js app for managing users, credits, and payment history.

**Architecture:** `ADMIN_SECRET` env var gates a login form that sets a signed `admin_session` cookie (itsdangerous, 24h). A new `backend/admin.py` FastAPI router handles all `/api/admin/*` endpoints. A new `transactions` SQLite table records each PayPal capture. The frontend is a client-side Next.js section under `frontend/app/admin/` with a sidebar layout and four pages.

**Tech Stack:** FastAPI + itsdangerous (backend), SQLite (storage), Next.js / TypeScript (frontend), existing CSS custom properties for styling.

---

### Task 1: Extend `database.py` — transactions table and admin query functions

**Files:**
- Modify: `backend/database.py`
- Modify: `backend/tests/conftest.py`
- Modify: `backend/tests/test_database.py`

- [ ] **Step 1: Add `ADMIN_SECRET` to conftest so admin tests can run**

In `backend/tests/conftest.py`, add one line after the existing `setdefault` calls:

```python
os.environ.setdefault("ADMIN_SECRET", "test-admin-secret")
```

- [ ] **Step 2: Write failing tests for the new database functions**

Append to `backend/tests/test_database.py`:

```python
def test_record_transaction_and_list():
    from database import upsert_user, record_transaction, list_transactions
    user = upsert_user("g1", "a@example.com", "Alice")
    record_transaction(user["id"], 3.00, 10, "ORDER-1")
    result = list_transactions(page=1)
    assert result["total"] == 1
    assert result["page"] == 1
    item = result["items"][0]
    assert item["amount_usd"] == 3.00
    assert item["credits_purchased"] == 10
    assert item["paypal_order_id"] == "ORDER-1"
    assert item["email"] == "a@example.com"


def test_list_transactions_pagination():
    from database import upsert_user, record_transaction, list_transactions
    user = upsert_user("g1", "a@example.com", "Alice")
    for i in range(25):
        record_transaction(user["id"], 3.00, 10, f"ORDER-{i}")
    page1 = list_transactions(page=1)
    page2 = list_transactions(page=2)
    assert page1["total"] == 25
    assert len(page1["items"]) == 20
    assert len(page2["items"]) == 5


def test_get_stats():
    from database import upsert_user, record_transaction, get_stats
    user = upsert_user("g1", "a@example.com", "Alice")
    stats = get_stats()
    assert stats["total_users"] == 1
    assert stats["total_revenue"] == 0.0
    assert stats["paying_users"] == 0
    assert stats["signups_today"] == 1
    record_transaction(user["id"], 3.00, 10, "ORDER-1")
    record_transaction(user["id"], 3.00, 10, "ORDER-2")
    stats2 = get_stats()
    assert stats2["total_revenue"] == 6.0
    assert stats2["paying_users"] == 1


def test_list_users_paginated():
    from database import upsert_user, list_users
    for i in range(5):
        upsert_user(f"g{i}", f"user{i}@example.com", f"User{i}")
    result = list_users(page=1)
    assert result["total"] == 5
    assert len(result["items"]) == 5
    assert "email" in result["items"][0]
    assert "credits" in result["items"][0]


def test_set_user_credits():
    from database import upsert_user, set_user_credits, get_credits
    user = upsert_user("g1", "a@example.com", "Alice")
    updated = set_user_credits(user["id"], 42)
    assert updated["credits"] == 42
    assert get_credits(user["id"]) == 42


def test_set_user_credits_returns_none_for_missing():
    from database import set_user_credits
    assert set_user_credits(9999, 10) is None
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend && .venv/bin/python -m pytest tests/test_database.py -v -k "transaction or stats or list_users or set_user"
```

Expected: FAIL (functions not defined yet)

- [ ] **Step 4: Add `transactions` table to `init_db` and implement the new functions**

Replace `backend/database.py` entirely:

```python
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "epubanything.db"

PAGE_SIZE = 20


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                google_id   TEXT UNIQUE NOT NULL,
                email       TEXT NOT NULL,
                name        TEXT,
                credits     INTEGER NOT NULL DEFAULT 0,
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id           INTEGER NOT NULL REFERENCES users(id),
                amount_usd        REAL NOT NULL,
                credits_purchased INTEGER NOT NULL,
                paypal_order_id   TEXT NOT NULL,
                created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)


def upsert_user(google_id: str, email: str, name: str) -> dict:
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO users (google_id, email, name)
            VALUES (?, ?, ?)
            ON CONFLICT(google_id) DO UPDATE SET email=excluded.email, name=excluded.name
            """,
            (google_id, email, name),
        )
        row = conn.execute(
            "SELECT * FROM users WHERE google_id = ?", (google_id,)
        ).fetchone()
        return dict(row)


def get_user_by_id(user_id: int) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        return dict(row) if row else None


def get_credits(user_id: int) -> int:
    with _connect() as conn:
        row = conn.execute(
            "SELECT credits FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        return row["credits"] if row else 0


def add_credits(user_id: int, amount: int) -> int:
    with _connect() as conn:
        conn.execute(
            "UPDATE users SET credits = credits + ? WHERE id = ?", (amount, user_id)
        )
        row = conn.execute(
            "SELECT credits FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        return row["credits"]


def deduct_credit(user_id: int) -> bool:
    with _connect() as conn:
        result = conn.execute(
            "UPDATE users SET credits = credits - 1 WHERE id = ? AND credits >= 1",
            (user_id,),
        )
        return result.rowcount == 1


def record_transaction(
    user_id: int, amount_usd: float, credits_purchased: int, paypal_order_id: str
) -> None:
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO transactions (user_id, amount_usd, credits_purchased, paypal_order_id)
            VALUES (?, ?, ?, ?)
            """,
            (user_id, amount_usd, credits_purchased, paypal_order_id),
        )


def list_transactions(page: int = 1) -> dict:
    offset = (page - 1) * PAGE_SIZE
    with _connect() as conn:
        total = conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
        rows = conn.execute(
            """
            SELECT t.id, t.amount_usd, t.credits_purchased, t.paypal_order_id,
                   t.created_at, u.email
            FROM transactions t
            JOIN users u ON u.id = t.user_id
            ORDER BY t.created_at DESC
            LIMIT ? OFFSET ?
            """,
            (PAGE_SIZE, offset),
        ).fetchall()
    return {"items": [dict(r) for r in rows], "total": total, "page": page}


def get_stats() -> dict:
    with _connect() as conn:
        total_users = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        total_revenue = conn.execute(
            "SELECT COALESCE(SUM(amount_usd), 0.0) FROM transactions"
        ).fetchone()[0]
        paying_users = conn.execute(
            "SELECT COUNT(DISTINCT user_id) FROM transactions"
        ).fetchone()[0]
        signups_today = conn.execute(
            "SELECT COUNT(*) FROM users WHERE date(created_at) = date('now')"
        ).fetchone()[0]
    return {
        "total_users": total_users,
        "total_revenue": total_revenue,
        "paying_users": paying_users,
        "signups_today": signups_today,
    }


def list_users(page: int = 1) -> dict:
    offset = (page - 1) * PAGE_SIZE
    with _connect() as conn:
        total = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        rows = conn.execute(
            """
            SELECT id, email, name, credits, created_at
            FROM users
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            """,
            (PAGE_SIZE, offset),
        ).fetchall()
    return {"items": [dict(r) for r in rows], "total": total, "page": page}


def set_user_credits(user_id: int, credits: int) -> dict | None:
    with _connect() as conn:
        result = conn.execute(
            "UPDATE users SET credits = ? WHERE id = ?", (credits, user_id)
        )
        if result.rowcount == 0:
            return None
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row)
```

- [ ] **Step 5: Run new tests to verify they pass**

```bash
cd backend && .venv/bin/python -m pytest tests/test_database.py -v
```

Expected: all database tests PASS

- [ ] **Step 6: Run the full suite to check no regressions**

```bash
cd backend && .venv/bin/python -m pytest -v
```

Expected: all 57 tests still PASS

- [ ] **Step 7: Commit**

```bash
git add backend/database.py backend/tests/test_database.py backend/tests/conftest.py
git commit -m "feat: add transactions table and admin query functions to database.py"
```

---

### Task 2: Record transactions in `payments.py`

**Files:**
- Modify: `backend/payments.py`
- Modify: `backend/tests/test_payments.py`

- [ ] **Step 1: Write a failing test for transaction recording**

Append to `backend/tests/test_payments.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && .venv/bin/python -m pytest tests/test_payments.py::test_capture_records_transaction -v
```

Expected: FAIL (record_transaction not called)

- [ ] **Step 3: Add `record_transaction` call in `payments.py`**

In `backend/payments.py`, add the import at the top alongside the existing database import:

```python
from database import add_credits, record_transaction
```

Then in the `capture` endpoint, after `new_balance = add_credits(...)`:

```python
    new_balance = add_credits(user["id"], PACK_CREDITS)
    record_transaction(user["id"], float(PACK_AMOUNT), PACK_CREDITS, body.orderId)
    return {"credits": new_balance}
```

The full updated `capture` endpoint:

```python
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
```

- [ ] **Step 4: Run all payment tests**

```bash
cd backend && .venv/bin/python -m pytest tests/test_payments.py -v
```

Expected: all payment tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/payments.py backend/tests/test_payments.py
git commit -m "feat: record transaction after successful PayPal capture"
```

---

### Task 3: Create `backend/admin.py` and wire it into `main.py`

**Files:**
- Create: `backend/admin.py`
- Modify: `backend/main.py`
- Create: `backend/tests/test_admin.py`

- [ ] **Step 1: Write failing tests for the admin router**

Create `backend/tests/test_admin.py`:

```python
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && .venv/bin/python -m pytest tests/test_admin.py -v
```

Expected: FAIL (module not found)

- [ ] **Step 3: Create `backend/admin.py`**

```python
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
```

- [ ] **Step 4: Include the admin router in `main.py`**

In `backend/main.py`, add the import alongside the existing router imports:

```python
from admin import router as admin_router
```

And after the existing `app.include_router(payments_router)` line, add:

```python
app.include_router(admin_router)
```

- [ ] **Step 5: Run admin tests**

```bash
cd backend && .venv/bin/python -m pytest tests/test_admin.py -v
```

Expected: all 8 admin tests PASS

- [ ] **Step 6: Run the full suite**

```bash
cd backend && .venv/bin/python -m pytest -v
```

Expected: all tests PASS (57 existing + 8 new = 65+)

- [ ] **Step 7: Commit**

```bash
git add backend/admin.py backend/main.py backend/tests/test_admin.py
git commit -m "feat: add admin API router with stats, users, payments, and credit management"
```

---

### Task 4: Frontend — admin layout and login page

**Files:**
- Create: `frontend/app/admin/layout.tsx`
- Create: `frontend/app/admin/login/page.tsx`

- [ ] **Step 1: Create the admin layout with sidebar and auth guard**

Create `frontend/app/admin/layout.tsx`:

```tsx
"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

function SidebarLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname()
  const active = pathname === href
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "6px 8px",
        borderRadius: 4,
        fontSize: 13,
        textDecoration: "none",
        color: active ? "var(--accent)" : "var(--fg-muted)",
        background: active ? "var(--bg-raised)" : "transparent",
      }}
    >
      {label}
    </Link>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (pathname === "/admin/login") {
      setReady(true)
      return
    }
    fetch("/api/admin/stats", { credentials: "include" })
      .then((r) => {
        if (r.status === 401) router.replace("/admin/login")
        else setReady(true)
      })
      .catch(() => router.replace("/admin/login"))
  }, [pathname])

  if (!ready) return null

  if (pathname === "/admin/login") return <>{children}</>

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)", fontFamily: "var(--font-ui)" }}>
      <aside
        style={{
          width: 160,
          background: "#111",
          padding: "20px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--accent)",
            fontSize: 16,
            marginBottom: 24,
            paddingLeft: 8,
          }}
        >
          ⚙ Admin
        </div>
        <SidebarLink href="/admin/dashboard" label="Dashboard" />
        <SidebarLink href="/admin/users" label="Users" />
        <SidebarLink href="/admin/payments" label="Payments" />
        <div style={{ flex: 1 }} />
        <Link href="/" style={{ fontSize: 12, color: "var(--fg-muted)", textDecoration: "none", paddingLeft: 8 }}>
          ← Back to site
        </Link>
      </aside>
      <main style={{ flex: 1, padding: 28, overflowY: "auto" }}>{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Create the login page**

Create `frontend/app/admin/login/page.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function AdminLoginPage() {
  const router = useRouter()
  const [secret, setSecret] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ secret }),
      })
      if (res.status === 401) {
        setError("Invalid password")
      } else if (res.ok) {
        router.push("/admin/dashboard")
      } else {
        setError("Something went wrong")
      }
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        fontFamily: "var(--font-ui)",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 32,
          width: 320,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 20, color: "var(--fg)", fontFamily: "var(--font-display)" }}>
          Admin Login
        </h1>
        <input
          type="password"
          placeholder="Admin password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          required
          style={{
            padding: "10px 12px",
            borderRadius: 4,
            border: "1px solid var(--border)",
            background: "var(--bg-raised)",
            color: "var(--fg)",
            fontSize: 14,
          }}
        />
        {error && <p style={{ margin: 0, color: "var(--error)", fontSize: 13 }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px",
            borderRadius: 4,
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontSize: 14,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Check TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/app/admin/
git commit -m "feat: add admin layout with sidebar and login page"
```

---

### Task 5: Frontend — dashboard page

**Files:**
- Create: `frontend/app/admin/dashboard/page.tsx`

- [ ] **Step 1: Create the dashboard page**

Create `frontend/app/admin/dashboard/page.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface Stats {
  total_users: number
  total_revenue: number
  paying_users: number
  signups_today: number
}

interface User {
  id: number
  email: string
  name: string | null
  credits: number
  created_at: string
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "20px 24px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 600, color: "var(--fg)", fontFamily: "var(--font-display)" }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentUsers, setRecentUsers] = useState<User[]>([])

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats", { credentials: "include" }),
      fetch("/api/admin/users?page=1", { credentials: "include" }),
    ]).then(async ([statsRes, usersRes]) => {
      if (statsRes.status === 401) { router.replace("/admin/login"); return }
      setStats(await statsRes.json())
      const usersData = await usersRes.json()
      setRecentUsers(usersData.items.slice(0, 10))
    })
  }, [])

  if (!stats) return <p style={{ color: "var(--fg-muted)" }}>Loading…</p>

  return (
    <div>
      <h2 style={{ margin: "0 0 24px", color: "var(--fg)", fontFamily: "var(--font-display)", fontWeight: 400 }}>
        Dashboard
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        <StatCard label="Total Users" value={stats.total_users} />
        <StatCard label="Total Revenue" value={`$${stats.total_revenue.toFixed(2)}`} />
        <StatCard label="Paying Users" value={stats.paying_users} />
        <StatCard label="Signups Today" value={stats.signups_today} />
      </div>

      <h3 style={{ margin: "0 0 12px", color: "var(--fg)", fontSize: 14, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        Recent Users
      </h3>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {["Email", "Name", "Credits", "Joined"].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "var(--fg-muted)", fontWeight: 400 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {recentUsers.map((u) => (
            <tr key={u.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <td style={{ padding: "10px 12px", color: "var(--fg)" }}>{u.email}</td>
              <td style={{ padding: "10px 12px", color: "var(--fg-muted)" }}>{u.name ?? "—"}</td>
              <td style={{ padding: "10px 12px", color: "var(--accent)" }}>{u.credits}</td>
              <td style={{ padding: "10px 12px", color: "var(--fg-muted)", fontSize: 12 }}>
                {u.created_at.slice(0, 10)}
              </td>
            </tr>
          ))}
          {recentUsers.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: "20px 12px", color: "var(--fg-muted)", textAlign: "center" }}>
                No users yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/app/admin/dashboard/page.tsx
git commit -m "feat: add admin dashboard page with stat cards and recent users"
```

---

### Task 6: Frontend — users page with inline credit editing

**Files:**
- Create: `frontend/app/admin/users/page.tsx`

- [ ] **Step 1: Create the users page**

Create `frontend/app/admin/users/page.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface User {
  id: number
  email: string
  name: string | null
  credits: number
  created_at: string
}

interface PageData {
  items: User[]
  total: number
  page: number
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [data, setData] = useState<PageData | null>(null)
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Record<number, number>>({})
  const [saving, setSaving] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<Record<number, string>>({})

  async function loadPage(p: number) {
    const res = await fetch(`/api/admin/users?page=${p}`, { credentials: "include" })
    if (res.status === 401) { router.replace("/admin/login"); return }
    setData(await res.json())
    setPage(p)
  }

  useEffect(() => { loadPage(1) }, [])

  async function saveCredits(userId: number) {
    const credits = editing[userId]
    setSaving(userId)
    setSaveError((prev) => ({ ...prev, [userId]: "" }))
    try {
      const res = await fetch(`/api/admin/users/${userId}/credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ credits }),
      })
      if (!res.ok) throw new Error("Failed")
      const updated: User = await res.json()
      setData((prev) =>
        prev
          ? { ...prev, items: prev.items.map((u) => (u.id === userId ? updated : u)) }
          : prev
      )
      setEditing((prev) => { const n = { ...prev }; delete n[userId]; return n })
    } catch {
      setSaveError((prev) => ({ ...prev, [userId]: "Save failed" }))
    } finally {
      setSaving(null)
    }
  }

  if (!data) return <p style={{ color: "var(--fg-muted)" }}>Loading…</p>

  const totalPages = Math.ceil(data.total / 20)

  return (
    <div>
      <h2 style={{ margin: "0 0 8px", color: "var(--fg)", fontFamily: "var(--font-display)", fontWeight: 400 }}>
        Users
      </h2>
      <p style={{ margin: "0 0 24px", color: "var(--fg-muted)", fontSize: 13 }}>
        {data.total} total — click a credit value to edit
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {["Email", "Name", "Credits", "Joined"].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "var(--fg-muted)", fontWeight: 400 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.items.map((u) => (
            <tr key={u.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <td style={{ padding: "10px 12px", color: "var(--fg)" }}>{u.email}</td>
              <td style={{ padding: "10px 12px", color: "var(--fg-muted)" }}>{u.name ?? "—"}</td>
              <td style={{ padding: "10px 12px" }}>
                {editing[u.id] !== undefined ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="number"
                      value={editing[u.id]}
                      min={0}
                      onChange={(e) => setEditing((prev) => ({ ...prev, [u.id]: Number(e.target.value) }))}
                      style={{
                        width: 64,
                        padding: "3px 6px",
                        borderRadius: 4,
                        border: "1px solid var(--border)",
                        background: "var(--bg-raised)",
                        color: "var(--fg)",
                        fontSize: 13,
                      }}
                    />
                    <button
                      onClick={() => saveCredits(u.id)}
                      disabled={saving === u.id}
                      style={{
                        padding: "3px 10px",
                        borderRadius: 4,
                        border: "none",
                        background: "var(--accent)",
                        color: "#fff",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {saving === u.id ? "…" : "Save"}
                    </button>
                    <button
                      onClick={() => setEditing((prev) => { const n = { ...prev }; delete n[u.id]; return n })}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 4,
                        border: "1px solid var(--border)",
                        background: "transparent",
                        color: "var(--fg-muted)",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                    {saveError[u.id] && (
                      <span style={{ color: "var(--error)", fontSize: 11 }}>{saveError[u.id]}</span>
                    )}
                  </span>
                ) : (
                  <span
                    onClick={() => setEditing((prev) => ({ ...prev, [u.id]: u.credits }))}
                    style={{ color: "var(--accent)", cursor: "pointer", borderBottom: "1px dashed var(--accent)" }}
                    title="Click to edit"
                  >
                    {u.credits}
                  </span>
                )}
              </td>
              <td style={{ padding: "10px 12px", color: "var(--fg-muted)", fontSize: 12 }}>
                {u.created_at.slice(0, 10)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 12, marginTop: 20, alignItems: "center" }}>
        <button
          onClick={() => loadPage(page - 1)}
          disabled={page <= 1}
          style={{
            padding: "6px 16px",
            borderRadius: 4,
            border: "1px solid var(--border)",
            background: "transparent",
            color: page <= 1 ? "var(--fg-subtle)" : "var(--fg)",
            cursor: page <= 1 ? "default" : "pointer",
            fontSize: 13,
          }}
        >
          ← Prev
        </button>
        <span style={{ color: "var(--fg-muted)", fontSize: 13 }}>
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => loadPage(page + 1)}
          disabled={page >= totalPages}
          style={{
            padding: "6px 16px",
            borderRadius: 4,
            border: "1px solid var(--border)",
            background: "transparent",
            color: page >= totalPages ? "var(--fg-subtle)" : "var(--fg)",
            cursor: page >= totalPages ? "default" : "pointer",
            fontSize: 13,
          }}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/app/admin/users/page.tsx
git commit -m "feat: add admin users page with paginated table and inline credit editing"
```

---

### Task 7: Frontend — payments page

**Files:**
- Create: `frontend/app/admin/payments/page.tsx`

- [ ] **Step 1: Create the payments page**

Create `frontend/app/admin/payments/page.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface Transaction {
  id: number
  email: string
  amount_usd: number
  credits_purchased: number
  paypal_order_id: string
  created_at: string
}

interface PageData {
  items: Transaction[]
  total: number
  page: number
}

export default function AdminPaymentsPage() {
  const router = useRouter()
  const [data, setData] = useState<PageData | null>(null)
  const [page, setPage] = useState(1)

  async function loadPage(p: number) {
    const res = await fetch(`/api/admin/payments?page=${p}`, { credentials: "include" })
    if (res.status === 401) { router.replace("/admin/login"); return }
    setData(await res.json())
    setPage(p)
  }

  useEffect(() => { loadPage(1) }, [])

  if (!data) return <p style={{ color: "var(--fg-muted)" }}>Loading…</p>

  const totalPages = Math.ceil(data.total / 20) || 1

  return (
    <div>
      <h2 style={{ margin: "0 0 8px", color: "var(--fg)", fontFamily: "var(--font-display)", fontWeight: 400 }}>
        Payments
      </h2>
      <p style={{ margin: "0 0 24px", color: "var(--fg-muted)", fontSize: 13 }}>
        {data.total} total transactions
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {["Date", "Email", "Amount", "Credits", "PayPal Order ID"].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "var(--fg-muted)", fontWeight: 400 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.items.map((t) => (
            <tr key={t.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <td style={{ padding: "10px 12px", color: "var(--fg-muted)", fontSize: 12 }}>
                {t.created_at.slice(0, 10)}
              </td>
              <td style={{ padding: "10px 12px", color: "var(--fg)" }}>{t.email}</td>
              <td style={{ padding: "10px 12px", color: "var(--accent)" }}>
                ${t.amount_usd.toFixed(2)}
              </td>
              <td style={{ padding: "10px 12px", color: "var(--fg-muted)" }}>{t.credits_purchased}</td>
              <td style={{ padding: "10px 12px", color: "var(--fg-muted)", fontSize: 11, fontFamily: "monospace" }}>
                {t.paypal_order_id}
              </td>
            </tr>
          ))}
          {data.items.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: "20px 12px", color: "var(--fg-muted)", textAlign: "center" }}>
                No transactions yet
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 12, marginTop: 20, alignItems: "center" }}>
        <button
          onClick={() => loadPage(page - 1)}
          disabled={page <= 1}
          style={{
            padding: "6px 16px",
            borderRadius: 4,
            border: "1px solid var(--border)",
            background: "transparent",
            color: page <= 1 ? "var(--fg-subtle)" : "var(--fg)",
            cursor: page <= 1 ? "default" : "pointer",
            fontSize: 13,
          }}
        >
          ← Prev
        </button>
        <span style={{ color: "var(--fg-muted)", fontSize: 13 }}>
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => loadPage(page + 1)}
          disabled={page >= totalPages}
          style={{
            padding: "6px 16px",
            borderRadius: 4,
            border: "1px solid var(--border)",
            background: "transparent",
            color: page >= totalPages ? "var(--fg-subtle)" : "var(--fg)",
            cursor: page >= totalPages ? "default" : "pointer",
            fontSize: 13,
          }}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/app/admin/payments/page.tsx
git commit -m "feat: add admin payments page with paginated transaction log"
```

---

### Task 8: Final verification and feature completion

**Files:**
- Modify: `feature_list.json`
- Modify: `progress.md`

- [ ] **Step 1: Run `./init.sh` — full suite must pass**

```bash
./init.sh
```

Expected: all backend tests PASS, TypeScript clean

- [ ] **Step 2: Manual smoke test**

Start the dev stack:
```bash
# Terminal 1
cd backend && ADMIN_SECRET=testpw SESSION_SECRET=dev-secret-32-chars-minimum!! GOOGLE_CLIENT_ID=x GOOGLE_CLIENT_SECRET=x PAYPAL_CLIENT_ID=x PAYPAL_CLIENT_SECRET=x .venv/bin/uvicorn main:app --reload

# Terminal 2
cd frontend && npm run dev
```

Verify in browser:
1. Visit `http://localhost:3000/admin` — should redirect to `/admin/login`
2. Enter wrong password — should show "Invalid password"
3. Enter `testpw` — should redirect to `/admin/dashboard`
4. Sidebar links navigate to Users and Payments pages
5. "← Back to site" returns to homepage
6. Users page loads empty table with "No users yet"
7. Payments page loads "No transactions yet"

- [ ] **Step 3: Update `feature_list.json`**

Set `feat-008` status to `"done"` and add evidence:

```json
{
  "id": "feat-008",
  "name": "Admin site",
  "description": "Password-protected /admin section in the Next.js app. ADMIN_SECRET env var gates a login form that sets a signed admin_session cookie (itsdangerous, 24h). Sidebar layout with Dashboard (4 stat cards + recent users), Users (paginated table with inline credit edit), and Payments (read-only transaction log). Requires new transactions table in SQLite and record_transaction() call after each PayPal capture. Backend admin.py router with 5 endpoints, all protected by require_admin dependency.",
  "dependencies": ["feat-007"],
  "status": "done",
  "evidence": "backend/admin.py, database.py (transactions table + 5 new functions), payments.py (record_transaction call). frontend/app/admin/ with layout, login, dashboard, users, payments pages. All tests pass. Manual smoke-tested."
}
```

- [ ] **Step 4: Update `progress.md`**

Add to Completed Features:
```
- [x] feat-008 — Admin site (/admin with sidebar, login, dashboard, users w/ credit editing, payments log. transactions table. 65+ tests pass.)
```

- [ ] **Step 5: Final commit**

```bash
git add feature_list.json progress.md
git commit -m "chore: mark feat-008 admin site as done"
```
