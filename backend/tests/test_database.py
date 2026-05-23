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
