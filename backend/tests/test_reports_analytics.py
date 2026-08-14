"""Tests for NEW Reports & Analytics admin endpoints (session Iter-14).

Covers:
  GET /api/analytics/enhanced
  GET /api/analytics/revenue-overview
  GET /api/analytics/transactions   (+ status filter)
  GET /api/analytics/location-overview

For each: unauthenticated -> 401/403, non-admin -> 403, admin -> 200 + shape check.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "admin@vibe.app"
ADMIN_PASSWORD = "Vibe@2026"

NEW_ENDPOINTS = ["enhanced", "revenue-overview", "transactions", "location-overview"]


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def user_token():
    email = f"TEST_rpt_{uuid.uuid4().hex[:8]}@test.com"
    r = requests.post(f"{BASE_URL}/api/auth/register",
                      json={"email": email, "password": "pass123", "name": "Rpt User"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


class TestAccessGating:
    @pytest.mark.parametrize("ep", NEW_ENDPOINTS)
    def test_unauth_returns_401_or_403(self, ep):
        r = requests.get(f"{BASE_URL}/api/analytics/{ep}")
        assert r.status_code in (401, 403), f"{ep}: {r.status_code}"

    @pytest.mark.parametrize("ep", NEW_ENDPOINTS)
    def test_non_admin_forbidden(self, ep, user_token):
        r = requests.get(f"{BASE_URL}/api/analytics/{ep}",
                         headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 403, f"{ep}: {r.status_code} {r.text}"


class TestEnhanced:
    def test_shape(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/analytics/enhanced",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "period" in data
        assert "overview" in data and isinstance(data["overview"], dict)
        ov = data["overview"]
        for k in ["total_streams", "revenue_streams", "unique_listeners",
                  "total_listening_hours", "avg_session_duration",
                  "gross_revenue", "platform_revenue", "unique_songs_played"]:
            assert k in ov, f"overview missing {k}"
        assert isinstance(ov["total_streams"], int)
        assert isinstance(ov["unique_listeners"], int)
        assert "top_songs" in data and isinstance(data["top_songs"], list)
        assert "category_breakdown" in data and isinstance(data["category_breakdown"], list)
        # top_songs entries shape (if any)
        for s in data["top_songs"]:
            assert set(["title", "artist", "plays"]).issubset(s.keys())


class TestRevenueOverview:
    def test_shape(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/analytics/revenue-overview",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["currency", "total_listening_hours", "gross_revenue",
                  "platform_earnings", "artist_payouts",
                  "daily", "top_artists", "top_albums", "all_artists"]:
            assert k in d, f"missing {k}"
        assert d["currency"] == "TZS"
        assert isinstance(d["daily"], list) and len(d["daily"]) == 14
        row = d["daily"][0]
        assert "date" in row and "amount" in row
        assert isinstance(d["top_artists"], list)
        assert isinstance(d["top_albums"], list)
        assert isinstance(d["all_artists"], list)
        # gross_revenue is a number
        assert isinstance(d["gross_revenue"], (int, float))
        # platform+artist payouts should approximate gross
        assert d["platform_earnings"] + d["artist_payouts"] in (d["gross_revenue"], d["gross_revenue"] - 1, d["gross_revenue"] + 1)


class TestTransactions:
    def test_shape_all(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/analytics/transactions",
                         params={"status": "all", "q": ""},
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "summary" in d and "gateways" in d and "transactions" in d
        s = d["summary"]
        for k in ["total", "completed_revenue", "pending", "failed"]:
            assert k in s, f"summary missing {k}"
        assert isinstance(d["gateways"], list)
        assert "azampay_simulated" in d["gateways"]
        assert isinstance(d["transactions"], list)

    def test_status_filter_completed(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/analytics/transactions",
                         params={"status": "completed"},
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        rows = r.json()["transactions"]
        for t in rows:
            assert t.get("status") == "completed", f"non-completed row leaked: {t}"

    def test_no_object_id_leak(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/analytics/transactions",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        for t in r.json()["transactions"]:
            assert "_id" not in t


class TestLocationOverview:
    def test_shape(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/analytics/location-overview",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["total_users", "total_countries", "countries", "growth"]:
            assert k in d, f"missing {k}"
        assert isinstance(d["total_users"], int)
        assert isinstance(d["total_countries"], int)
        assert isinstance(d["countries"], list)
        for c in d["countries"]:
            assert "name" in c and "value" in c
        assert isinstance(d["growth"], list) and len(d["growth"]) == 6
        for g in d["growth"]:
            assert "month" in g and "new" in g and "cumulative" in g
