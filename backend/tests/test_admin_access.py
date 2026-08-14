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
        required_keys = [
            "total_users", "premium_users", "total_songs", "total_albums",
            "total_plays", "total_playlists", "total_radio", "total_churches",
            "total_neno", "total_plans", "total_transactions",
            "guest_plays", "logged_plays", "revenue", "currency",
            "top_songs", "recent_transactions",
        ]
        for key in required_keys:
            assert key in data, f"missing {key} in stats"
        # type sanity
        assert isinstance(data["top_songs"], list)
        assert isinstance(data["recent_transactions"], list)
        assert isinstance(data["total_users"], int)
        assert isinstance(data["guest_plays"], int)
        assert isinstance(data["logged_plays"], int)
        assert data["currency"] == "TZS"

    # --- Admin CRUD regression ---
    def test_admin_users_list(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/users",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        users = r.json()
        assert isinstance(users, list)
        assert any(u.get("email") == ADMIN_EMAIL for u in users)

    def test_admin_users_forbidden_for_non_admin(self, user_token):
        r = requests.get(f"{BASE_URL}/api/admin/users",
                         headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 403

    def test_admin_create_album_and_song(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        payload = {
            "title": f"TEST_album_{uuid.uuid4().hex[:6]}",
            "artist_name": "TEST Artist",
            "thumbnail": "https://picsum.photos/seed/vibe/400",
        }
        r = requests.post(f"{BASE_URL}/api/admin/albums", json=payload, headers=h)
        assert r.status_code == 200, r.text
        alb = r.json()
        assert alb["title"] == payload["title"]
        assert alb["album_id"].startswith("alb_")
        album_id = alb["album_id"]

        song_payload = {
            "title": f"TEST_song_{uuid.uuid4().hex[:6]}",
            "album_id": album_id,
            "audio_url": "https://example.com/x.mp3",
            "duration": 120,
        }
        r2 = requests.post(f"{BASE_URL}/api/admin/songs", json=song_payload, headers=h)
        assert r2.status_code == 200, r2.text
        song = r2.json()
        assert song["title"] == song_payload["title"]
        assert song["album_id"] == album_id
        assert song["song_id"].startswith("song_")

        # cleanup
        requests.delete(f"{BASE_URL}/api/admin/songs/{song['song_id']}", headers=h)
        requests.delete(f"{BASE_URL}/api/admin/albums/{album_id}", headers=h)

    def test_admin_album_forbidden_for_non_admin(self, user_token):
        r = requests.post(f"{BASE_URL}/api/admin/albums",
                          json={"title": "x", "artist_name": "y"},
                          headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 403

    def test_stats_without_token(self):
        r = requests.get(f"{BASE_URL}/api/admin/stats")
        assert r.status_code in (401, 403), r.status_code

    def test_stats_with_non_admin_token(self, user_token):
        r = requests.get(f"{BASE_URL}/api/admin/stats",
                         headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 403, r.status_code
