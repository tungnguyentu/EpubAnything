import os

# Must run before any app module is imported
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-client-id")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test-client-secret")
os.environ.setdefault("SESSION_SECRET", "test-session-secret-key-32-chars!!")
os.environ.setdefault("PAYPAL_CLIENT_ID", "test-paypal-client")
os.environ.setdefault("PAYPAL_CLIENT_SECRET", "test-paypal-secret")
os.environ.setdefault("PAYPAL_MODE", "sandbox")

import pytest


@pytest.fixture(autouse=True)
def isolated_db(tmp_path, monkeypatch):
    import database
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "test.db")
    database.init_db()
