"""Tests for admin analytics endpoints and DELETE /api/auth/me.

Covers the review request:
- GET /api/analytics/{overview,trends,user-demographics,realtime,download-stats,live-listeners}
  require admin bearer token (401 without, 403 for regular user, 200 for admin).
- download-stats may return null (dashboard hides banner).
- DELETE /api/auth/me deletes a regular user (subsequent /auth/me -> 401).
- Admin cannot self-delete (403).
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "admin@vibe.app"
ADMIN_PASSWORD = "Vibe@2026"

ANALYTICS_ENDPOINTS = [
    "overview",
    "trends",
    "user-demographics",
    "realtime",
    "download-stats",
    "live-listeners",
]


# --- shared tokens ---
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def user_creds():
    email = f"TEST_del_{uuid.uuid4().hex[:8]}@test.com"
    password = "pass123"
    r = requests.post(f"{BASE_URL}/api/auth/register",
                      json={"email": email, "password": password, "name": "Del User"})
    assert r.status_code == 200, r.text
    return {"email": email, "password": password, "token": r.json()["access_token"]}


# --- Analytics gating & shapes ---
class TestAnalyticsAccess:
    @pytest.mark.parametrize("ep", ANALYTICS_ENDPOINTS)
    def test_unauthenticated_returns_401_or_403(self, ep):
        r = requests.get(f"{BASE_URL}/api/analytics/{ep}")
        assert r.status_code in (401, 403), f"{ep}: {r.status_code}"

    @pytest.mark.parametrize("ep", ANALYTICS_ENDPOINTS)
    def test_non_admin_forbidden(self, ep, user_creds):
        r = requests.get(f"{BASE_URL}/api/analytics/{ep}",
                         headers={"Authorization": f"Bearer {user_creds['token']}"})
        assert r.status_code == 403, f"{ep}: {r.status_code} {r.text}"

    def test_overview_shape(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/analytics/overview",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["total_users", "total_customers", "total_system_users",
                  "total_songs", "total_albums", "total_churches", "total_leaders",
                  "total_donations", "pending_approvals", "total_raised", "currency"]:
            assert k in data, f"missing {k}"
        assert data["currency"] == "TZS"
        assert isinstance(data["total_users"], int)

    def test_trends_shape(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/analytics/trends",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["user_growth", "content_performance", "donations_trend"]:
            assert k in data
        assert isinstance(data["user_growth"], list)
        assert len(data["user_growth"]) == 6
        row = data["user_growth"][0]
        for k in ["month", "users", "active"]:
            assert k in row
        assert len(data["donations_trend"]) == 6
        assert isinstance(data["content_performance"], list)

    def test_user_demographics_shape(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/analytics/user-demographics",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["total_users", "device", "gender", "age", "location"]:
            assert k in data
        assert isinstance(data["device"]["data"], list)
        assert isinstance(data["gender"]["data"], list)
        assert isinstance(data["age"]["data"], list)
        assert isinstance(data["location"]["data"], list)
        assert "total_locations" in data["location"]

    def test_realtime_shape(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/analytics/realtime",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["timestamp", "active_streams", "active_listeners", "plays_today",
                  "guest_visitors_today", "new_users_today", "transactions_today"]:
            assert k in data
        assert isinstance(data["active_streams"], int)

    def test_download_stats_ok(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/analytics/download-stats",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        data = r.json()
        # Valid: null (no downloads) OR dict with expected keys
        assert data is None or (
            isinstance(data, dict)
            and {"total_downloads", "downloads_today", "downloads_this_week",
                 "unique_downloaders", "top_downloaded_songs"} <= set(data.keys())
        ), f"unexpected shape: {data}"

    def test_live_listeners_shape(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/analytics/live-listeners",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["total_active_listeners", "unique_users", "top_playing_now", "timestamp"]:
            assert k in data
        assert isinstance(data["top_playing_now"], list)


# --- DELETE /api/auth/me ---
class TestDeleteAccount:
    def test_regular_user_can_self_delete(self):
        email = f"TEST_selfdel_{uuid.uuid4().hex[:8]}@test.com"
        password = "pass123"
        r = requests.post(f"{BASE_URL}/api/auth/register",
                          json={"email": email, "password": password, "name": "Self Del"})
        assert r.status_code == 200, r.text
        token = r.json()["access_token"]
        h = {"Authorization": f"Bearer {token}"}

        # sanity: /me works before delete
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=h)
        assert me.status_code == 200
        assert me.json()["email"] == email.lower()

        d = requests.delete(f"{BASE_URL}/api/auth/me", headers=h)
        assert d.status_code == 200, d.text
        assert d.json().get("ok") is True

        # /me should now fail (user deleted)
        me2 = requests.get(f"{BASE_URL}/api/auth/me", headers=h)
        assert me2.status_code == 401, f"expected 401 after delete, got {me2.status_code}"

        # cannot log back in
        lg = requests.post(f"{BASE_URL}/api/auth/login",
                           json={"email": email, "password": password})
        assert lg.status_code == 401

    def test_admin_cannot_self_delete(self, admin_token):
        r = requests.delete(f"{BASE_URL}/api/auth/me",
                            headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 403, r.text

        # confirm admin still exists
        me = requests.get(f"{BASE_URL}/api/auth/me",
                          headers={"Authorization": f"Bearer {admin_token}"})
        assert me.status_code == 200
        assert me.json()["role"] == "admin"

    def test_delete_without_token(self):
        r = requests.delete(f"{BASE_URL}/api/auth/me")
        assert r.status_code in (401, 403)
