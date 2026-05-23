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
                paypal_order_id   TEXT NOT NULL UNIQUE,
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


def add_credits_and_record_transaction(
    user_id: int, amount_usd: float, credits: int, paypal_order_id: str
) -> int:
    """Atomically credits the user and records the transaction. Raises sqlite3.IntegrityError on duplicate paypal_order_id."""
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO transactions (user_id, amount_usd, credits_purchased, paypal_order_id)
            VALUES (?, ?, ?, ?)
            """,
            (user_id, amount_usd, credits, paypal_order_id),
        )
        conn.execute("UPDATE users SET credits = credits + ? WHERE id = ?", (credits, user_id))
        row = conn.execute("SELECT credits FROM users WHERE id = ?", (user_id,)).fetchone()
        return row[0]


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
    page = max(1, page)
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
    page = max(1, page)
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
        row = conn.execute(
            "SELECT id, email, name, credits, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        return dict(row)
