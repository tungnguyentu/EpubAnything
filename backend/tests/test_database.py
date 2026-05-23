def test_upsert_user_creates():
    from database import upsert_user, get_user_by_id
    user = upsert_user("google_123", "a@example.com", "Alice")
    assert user["email"] == "a@example.com"
    assert user["credits"] == 0
    fetched = get_user_by_id(user["id"])
    assert fetched is not None


def test_upsert_user_updates_existing():
    from database import upsert_user
    upsert_user("google_123", "a@example.com", "Alice")
    updated = upsert_user("google_123", "new@example.com", "Alice New")
    assert updated["email"] == "new@example.com"
    assert updated["google_id"] == "google_123"


def test_add_credits_returns_new_balance():
    from database import upsert_user, add_credits, get_credits
    user = upsert_user("google_123", "a@example.com", "Alice")
    balance = add_credits(user["id"], 10)
    assert balance == 10
    assert get_credits(user["id"]) == 10


def test_deduct_credit_succeeds_when_balance_positive():
    from database import upsert_user, add_credits, deduct_credit, get_credits
    user = upsert_user("google_123", "a@example.com", "Alice")
    add_credits(user["id"], 1)
    assert deduct_credit(user["id"]) is True
    assert get_credits(user["id"]) == 0


def test_deduct_credit_fails_when_balance_zero():
    from database import upsert_user, deduct_credit
    user = upsert_user("google_123", "a@example.com", "Alice")
    assert deduct_credit(user["id"]) is False


def test_get_user_by_id_returns_none_for_missing():
    from database import get_user_by_id
    assert get_user_by_id(9999) is None
