"""Vibe backend integration tests — covers all APIs listed in the review request.

Run:
    pytest /app/backend/tests/test_vibe_backend.py -v \
        --junitxml=/app/test_reports/pytest/pytest_results.xml
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://logic-6.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@vibe.app"
ADMIN_PASSWORD = "Vibe@2026"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def user_creds():
    return {
        "email": f"TEST_{uuid.uuid4().hex[:8]}@test.com",
        "password": "pass123",
        "name": "TEST User",
    }


@pytest.fixture(scope="session")
def user_token(s, user_creds):
    r = s.post(f"{API}/auth/register", json=user_creds)
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


# ---------------- Health / Home / Public catalog ----------------
class TestHealth:
    def test_health(self, s):
        r = s.get(f"{API}/health")
        assert r.status_code == 200
        assert r.json().get("status") == "healthy"


class TestHome:
    def test_home_sections(self, s):
        r = s.get(f"{API}/home")
        assert r.status_code == 200
        data = r.json()
        assert "sections" in data
        assert isinstance(data["sections"], list)
        assert len(data["sections"]) >= 2
        ids = [sec["id"] for sec in data["sections"]]
        assert "trending" in ids and "new" in ids

    def test_categories(self, s):
        r = s.get(f"{API}/categories")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestCatalog:
    def test_list_albums(self, s):
        r = s.get(f"{API}/albums")
        assert r.status_code == 200
        albums = r.json()
        assert isinstance(albums, list) and len(albums) > 0
        pytest.album_id = albums[0]["album_id"]

    def test_album_detail(self, s):
        r = s.get(f"{API}/albums/{pytest.album_id}")
        assert r.status_code == 200
        data = r.json()
        assert data["album_id"] == pytest.album_id
        assert "songs" in data and isinstance(data["songs"], list)
        assert data["songs_count"] == len(data["songs"])
        if data["songs"]:
            pytest.song_id = data["songs"][0]["song_id"]

    def test_list_songs(self, s):
        r = s.get(f"{API}/songs")
        assert r.status_code == 200
        songs = r.json()
        assert isinstance(songs, list) and len(songs) > 0
        if not getattr(pytest, "song_id", None):
            pytest.song_id = songs[0]["song_id"]

    def test_search(self, s):
        r = s.get(f"{API}/search", params={"q": "a"})
        assert r.status_code == 200
        data = r.json()
        assert "albums" in data and "songs" in data


# ---------------- Auth ----------------
class TestAuth:
    def test_admin_login_with_password(self, s):
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "admin"

    def test_admin_login_with_empty_password(self, s):
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ""})
        assert r.status_code == 200, f"Empty-password admin login failed: {r.text}"
        assert r.json()["user"]["role"] == "admin"

    def test_register_and_me(self, s, user_token):
        r = s.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 200
        assert r.json().get("email", "").startswith("test_")

    def test_login_wrong_password(self, s):
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401


# ---------------- Play tracking & Recommendations ----------------
def _get_a_song_id(s):
    songs = s.get(f"{API}/songs").json()
    assert songs, "No songs seeded"
    return songs[0]["song_id"]


class TestPlayback:
    def test_play_increments(self, s):
        song_id = _get_a_song_id(s)
        r0 = s.get(f"{API}/songs/{song_id}")
        assert r0.status_code == 200
        before = r0.json().get("plays", 0)
        r = s.post(f"{API}/songs/{song_id}/play")
        assert r.status_code == 200
        assert r.json().get("ok") is True
        r2 = s.get(f"{API}/songs/{song_id}")
        after = r2.json().get("plays", 0)
        assert after == before + 1, f"Plays not incremented: before={before} after={after}"

    def test_recommendations_next(self, s):
        song_id = _get_a_song_id(s)
        r = s.get(f"{API}/recommendations/next", params={"song_id": song_id, "limit": 10})
        assert r.status_code == 200
        data = r.json()
        assert "songs" in data
        assert isinstance(data["songs"], list)
        assert len(data["songs"]) > 0
        assert song_id not in [x["song_id"] for x in data["songs"]]


# ---------------- Playlists + Library ----------------
class TestPlaylists:
    def test_playlists_require_auth(self, s):
        r = s.get(f"{API}/playlists")
        assert r.status_code in (401, 403)

    def test_playlist_crud(self, s, user_token):
        h = {"Authorization": f"Bearer {user_token}"}
        # Create
        r = s.post(f"{API}/playlists", json={"name": "TEST_Playlist"}, headers=h)
        assert r.status_code == 200
        pl = r.json()
        pid = pl["playlist_id"]
        # List
        r = s.get(f"{API}/playlists", headers=h)
        assert r.status_code == 200
        assert any(p["playlist_id"] == pid for p in r.json())
        # Add song
        r = s.post(f"{API}/playlists/{pid}/songs", json={"song_id": pytest.song_id}, headers=h)
        assert r.status_code == 200
        assert r.json()["songs_count"] == 1
        # Remove song
        r = s.delete(f"{API}/playlists/{pid}/songs/{pytest.song_id}", headers=h)
        assert r.status_code == 200
        assert r.json()["songs_count"] == 0
        # Delete playlist
        r = s.delete(f"{API}/playlists/{pid}", headers=h)
        assert r.status_code == 200

    def test_like_toggle(self, s, user_token):
        h = {"Authorization": f"Bearer {user_token}"}
        r = s.post(f"{API}/library/like/{pytest.song_id}", headers=h)
        assert r.status_code == 200
        assert r.json()["liked"] is True
        r = s.get(f"{API}/library/liked", headers=h)
        assert r.status_code == 200
        assert any(x["song_id"] == pytest.song_id for x in r.json())
        # Toggle off
        r = s.post(f"{API}/library/like/{pytest.song_id}", headers=h)
        assert r.json()["liked"] is False


# ---------------- Content: Radio / Bible / Neno / Churches ----------------
class TestContent:
    def test_radio(self, s):
        r = s.get(f"{API}/radio")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_bible_books(self, s):
        r = s.get(f"{API}/bible/books")
        assert r.status_code == 200
        books = r.json()
        assert isinstance(books, list) and len(books) > 0

    def test_bible_genesis_chapter_1(self, s):
        r = s.get(f"{API}/bible/books/gen/chapters/1")
        assert r.status_code == 200
        data = r.json()
        assert data["book_id"] == "gen"
        assert data["chapter"] == 1
        assert isinstance(data["verses"], list) and len(data["verses"]) > 0
        assert data.get("has_audio") is True
        assert data.get("audio_url")

    def test_neno_active(self, s):
        r = s.get(f"{API}/neno-la-leo/active")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_churches_list_and_detail(self, s):
        r = s.get(f"{API}/churches")
        assert r.status_code == 200
        churches = r.json()
        assert isinstance(churches, list) and len(churches) > 0
        cid = churches[0]["church_id"]
        r = s.get(f"{API}/churches/{cid}")
        assert r.status_code == 200
        assert r.json()["church_id"] == cid
        assert "announcements" in r.json()


# ---------------- Billing / Subscription ----------------
class TestBilling:
    def test_billing_status(self, s):
        r = s.get(f"{API}/billing-status")
        assert r.status_code == 200
        data = r.json()
        assert data["guest_play_limit"] == 5
        assert data["skip_tiers"] == [6, 3, 3]
        assert data["preview_seconds"] == 15

    def test_subscription_plans(self, s):
        r = s.get(f"{API}/subscription-plans")
        assert r.status_code == 200
        plans = r.json()
        assert len(plans) >= 3
        pytest.plan_id = plans[0]["plan_id"]

    def test_payment_azampay_activates_premium(self, s, user_token):
        h = {"Authorization": f"Bearer {user_token}"}
        r = s.post(
            f"{API}/payment/azampay/initiate",
            json={"plan_id": pytest.plan_id, "phone": "0712345678"},
            headers=h,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert data["success"] is True
        # Verify /me shows premium
        me = s.get(f"{API}/auth/me", headers=h).json()
        assert me["is_premium"] is True

    def test_payment_requires_auth(self, s):
        r = s.post(f"{API}/payment/azampay/initiate", json={"plan_id": pytest.plan_id, "phone": "1"})
        assert r.status_code in (401, 403)


# ---------------- Admin ----------------
class TestAdmin:
    def test_admin_stats(self, s, admin_token):
        r = s.get(f"{API}/admin/stats", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        data = r.json()
        for k in ["total_users", "premium_users", "total_songs", "total_albums", "total_plays", "revenue"]:
            assert k in data

    def test_admin_users(self, s, admin_token):
        r = s.get(f"{API}/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_analytics_plays(self, s, admin_token):
        r = s.get(f"{API}/admin/analytics/plays", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        data = r.json()
        assert set(["guest_plays", "logged_in_plays", "total"]).issubset(data.keys())

    def test_non_admin_forbidden(self, s, user_token):
        r = s.get(f"{API}/admin/stats", headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 403

    def test_admin_create_album_and_song(self, s, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = s.post(
            f"{API}/admin/albums",
            json={"title": "TEST_Album", "artist_name": "TEST_Artist"},
            headers=h,
        )
        assert r.status_code == 200
        album = r.json()
        album_id = album["album_id"]
        # Verify listable
        r2 = s.get(f"{API}/albums/{album_id}")
        assert r2.status_code == 200
        # Add song
        r = s.post(
            f"{API}/admin/songs",
            json={
                "title": "TEST_Song",
                "album_id": album_id,
                "audio_url": "https://example.com/a.mp3",
                "duration": 120,
            },
            headers=h,
        )
        assert r.status_code == 200
        song = r.json()
        # Cleanup
        s.delete(f"{API}/admin/songs/{song['song_id']}", headers=h)
        s.delete(f"{API}/admin/albums/{album_id}", headers=h)
