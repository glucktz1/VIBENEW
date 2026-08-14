"""Admin access flow tests for Vibe.

Verifies:
- Admin login (seeded from env) works with correct password and empty password.
- /api/auth/me returns role 'admin'.
- /api/admin/stats gates: 200 for admin token, 401 no token, 403 non-admin token.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://logic-6.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@vibe.app"
ADMIN_PASSWORD = "Vibe@2026"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Admin login ---
class TestAdminLogin:
    def test_login_with_password(self, client):
        r = client.post(f"{BASE_URL}/api/auth/login",
                        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"

    def test_login_with_empty_password(self, client):
        r = client.post(f"{BASE_URL}/api/auth/login",
                        json={"email": ADMIN_EMAIL, "password": ""})
        assert r.status_code == 200, r.text
        assert r.json()["user"]["role"] == "admin"

    def test_me_returns_admin_role(self, client):
        r = client.post(f"{BASE_URL}/api/auth/login",
                        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        token = r.json()["access_token"]
        me = client.get(f"{BASE_URL}/api/auth/me",
                        headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        body = me.json()
        assert body["role"] == "admin"
        assert body["email"] == ADMIN_EMAIL


# --- Admin stats gating ---
class TestAdminStatsGating:
    @pytest.fixture(scope="class")
    def admin_token(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        return r.json()["access_token"]

    @pytest.fixture(scope="class")
    def user_token(self):
        email = f"TEST_nonadmin_{uuid.uuid4().hex[:8]}@test.com"
        r = requests.post(f"{BASE_URL}/api/auth/register",
                          json={"email": email, "password": "pass123", "name": "Non Admin"})
        assert r.status_code == 200, r.text
        return r.json()["access_token"]

    def test_stats_with_admin_token(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/stats",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        data = r.json()
        # basic shape check
        for key in ["total_users", "total_songs", "total_albums"]:
            assert key in data, f"missing {key} in stats"

    def test_stats_without_token(self):
        r = requests.get(f"{BASE_URL}/api/admin/stats")
        assert r.status_code in (401, 403), r.status_code

    def test_stats_with_non_admin_token(self, user_token):
        r = requests.get(f"{BASE_URL}/api/admin/stats",
                         headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 403, r.status_code
