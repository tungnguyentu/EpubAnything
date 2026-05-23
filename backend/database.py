import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "epubanything.db"


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
