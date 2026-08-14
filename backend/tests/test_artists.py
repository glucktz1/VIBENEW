"""Artist portal API tests (Session 9).

Covers:
- Register / login (pending vs approved gating)
- /me + wrong creds
- Album + song CRUD scoped to the artist
- Audio upload + media serve (Emergent object storage)
- Earnings summary shape + withdrawal amount validation
- Admin artist/withdrawal management + auth gating
"""
import io
import os
import uuid

import pytest
import requests

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "admin@vibe.app"
ADMIN_PASS = "Vibe@2026"
DEMO_ARTIST = ("artist@vibe.app", "Artist@2026")


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(api):
    r = api.post(f"{BASE}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def pending_artist(api):
    email = f"TEST_pending_{uuid.uuid4().hex[:8]}@test.com"
    r = api.post(f"{BASE}/api/artists/register", json={"email": email, "password": "pass123", "name": "Pending T"})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["status"] == "pending"
    assert j["artist"]["status"] == "pending"
    return {"email": email, "password": "pass123", "artist_id": j["artist"]["artist_id"]}


@pytest.fixture(scope="module")
def demo_token(api):
    r = api.post(f"{BASE}/api/artists/login", json={"email": DEMO_ARTIST[0], "password": DEMO_ARTIST[1]})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def auth(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- auth ----------
class TestArtistAuth:
    def test_register_duplicate_409(self, api, pending_artist):
        r = api.post(f"{BASE}/api/artists/register", json={
            "email": pending_artist["email"], "password": "pass123", "name": "Dup"
        })
        assert r.status_code == 409, r.text

    def test_pending_login_403(self, api, pending_artist):
        r = api.post(f"{BASE}/api/artists/login", json={
            "email": pending_artist["email"], "password": pending_artist["password"]
        })
        assert r.status_code == 403, r.text

    def test_wrong_password_401(self, api):
        r = api.post(f"{BASE}/api/artists/login", json={"email": DEMO_ARTIST[0], "password": "WRONG_pw"})
        assert r.status_code == 401, r.text

    def test_approved_login_200_and_me(self, api, demo_token):
        assert demo_token
        r = api.get(f"{BASE}/api/artists/me", headers=auth(demo_token))
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["email"] == DEMO_ARTIST[0]
        assert j["status"] == "approved"

    def test_me_no_token_401(self, api):
        r = requests.get(f"{BASE}/api/artists/me")
        assert r.status_code == 401


# ---------- content ----------
class TestContent:
    @pytest.fixture(scope="class")
    def album_id(self, api, demo_token):
        r = api.post(f"{BASE}/api/artists/albums",
                     json={"title": f"TEST_alb_{uuid.uuid4().hex[:6]}"},
                     headers=auth(demo_token))
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["status"] == "pending"
        assert j["artist_id"]
        assert "_id" not in j
        return j["album_id"]

    def test_create_song_owned_album(self, api, demo_token, album_id):
        r = api.post(f"{BASE}/api/artists/songs", json={
            "title": f"TEST_song_{uuid.uuid4().hex[:6]}",
            "album_id": album_id,
            "audio_url": "https://example.com/x.mp3",
        }, headers=auth(demo_token))
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["status"] == "pending"
        assert j["album_id"] == album_id
        assert "_id" not in j

    def test_create_song_unknown_album_404(self, api, demo_token):
        r = api.post(f"{BASE}/api/artists/songs", json={
            "title": "x", "album_id": "alb_nope", "audio_url": "https://x/y.mp3"
        }, headers=auth(demo_token))
        assert r.status_code == 404, r.text

    def test_list_scoped_to_artist(self, api, demo_token, album_id):
        r = api.get(f"{BASE}/api/artists/albums", headers=auth(demo_token))
        assert r.status_code == 200
        albums = r.json()
        assert any(a["album_id"] == album_id for a in albums)
        r = api.get(f"{BASE}/api/artists/songs", headers=auth(demo_token))
        assert r.status_code == 200
        songs = r.json()
        # Every song belongs to this artist
        me = api.get(f"{BASE}/api/artists/me", headers=auth(demo_token)).json()
        for s in songs:
            assert s["artist_id"] == me["artist_id"]


# ---------- audio upload ----------
class TestUpload:
    def test_upload_and_serve(self, api, demo_token):
        # ~ small mp3 header + junk; storage doesn't validate audio structure
        data = b"ID3\x03\x00\x00\x00" + b"TEST_audio_" + uuid.uuid4().bytes
        files = {"file": ("clip.mp3", io.BytesIO(data), "audio/mpeg")}
        r = requests.post(f"{BASE}/api/artists/upload-audio", headers=auth(demo_token), files=files)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["path"].startswith("vibe/uploads/")
        assert j["media_url"].startswith("/api/artists/media/")

        # Serve back
        r2 = requests.get(f"{BASE}{j['media_url']}")
        assert r2.status_code == 200, r2.text
        assert r2.content == data
        ct = r2.headers.get("Content-Type", "")
        assert "audio" in ct or ct == "application/octet-stream"


# ---------- earnings + withdrawals ----------
class TestEarningsWithdrawals:
    def test_earnings_shape(self, api, demo_token):
        r = api.get(f"{BASE}/api/artists/earnings", headers=auth(demo_token))
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["currency"] == "TZS"
        assert j["per_play_rate"] == 50
        for k in ("total_plays", "total_earned", "total_withdrawn", "pending", "available"):
            assert k in j
            assert isinstance(j[k], int)

    def test_withdraw_exceeds_available_400(self, api, demo_token):
        r = api.get(f"{BASE}/api/artists/earnings", headers=auth(demo_token))
        avail = r.json()["available"]
        r2 = api.post(f"{BASE}/api/artists/withdrawals",
                      json={"amount": avail + 1_000_000, "method": "mobile_money", "details": "TEST"},
                      headers=auth(demo_token))
        assert r2.status_code == 400, r2.text

    def test_withdraw_valid_or_zero_available(self, api, demo_token):
        r = api.get(f"{BASE}/api/artists/earnings", headers=auth(demo_token))
        avail = r.json()["available"]
        if avail <= 0:
            # Cannot request; validate zero-guard: any positive amount rejected
            r2 = api.post(f"{BASE}/api/artists/withdrawals",
                          json={"amount": 100, "method": "mobile_money", "details": "TEST"},
                          headers=auth(demo_token))
            assert r2.status_code == 400
            pytest.skip("Demo artist has no available balance; positive path skipped.")
        r2 = api.post(f"{BASE}/api/artists/withdrawals",
                      json={"amount": min(100, avail), "method": "mobile_money", "details": "TEST"},
                      headers=auth(demo_token))
        assert r2.status_code == 200, r2.text
        assert r2.json()["status"] == "pending"

    def test_list_withdrawals(self, api, demo_token):
        r = api.get(f"{BASE}/api/artists/withdrawals", headers=auth(demo_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- admin management ----------
class TestAdminMgmt:
    def test_list_artists_admin(self, api, admin_token, pending_artist):
        r = api.get(f"{BASE}/api/artists/admin/all", headers=auth(admin_token))
        assert r.status_code == 200, r.text
        rows = r.json()
        assert any(a["artist_id"] == pending_artist["artist_id"] for a in rows)
        # never leak password_hash
        assert all("password_hash" not in a for a in rows)

    def test_list_artists_requires_admin(self, api, demo_token):
        r = api.get(f"{BASE}/api/artists/admin/all", headers=auth(demo_token))
        assert r.status_code in (401, 403), r.text

    def test_list_artists_unauth(self):
        r = requests.get(f"{BASE}/api/artists/admin/all")
        assert r.status_code in (401, 403)

    def test_approve_pending_and_login_now_works(self, api, admin_token, pending_artist):
        r = api.post(f"{BASE}/api/artists/admin/{pending_artist['artist_id']}/status",
                     json={"status": "approved"}, headers=auth(admin_token))
        assert r.status_code == 200, r.text
        # Login now works
        r2 = api.post(f"{BASE}/api/artists/login",
                      json={"email": pending_artist["email"], "password": pending_artist["password"]})
        assert r2.status_code == 200, r2.text

    def test_invalid_status_400(self, api, admin_token, pending_artist):
        r = api.post(f"{BASE}/api/artists/admin/{pending_artist['artist_id']}/status",
                     json={"status": "bogus"}, headers=auth(admin_token))
        assert r.status_code == 400

    def test_admin_withdrawals_list(self, api, admin_token):
        r = api.get(f"{BASE}/api/artists/admin/withdrawals/all", headers=auth(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_set_withdrawal_status_invalid(self, api, admin_token):
        r = api.post(f"{BASE}/api/artists/admin/withdrawals/wd_none/status",
                     json={"status": "bogus"}, headers=auth(admin_token))
        assert r.status_code == 400

    def test_admin_set_withdrawal_status_notfound(self, api, admin_token):
        r = api.post(f"{BASE}/api/artists/admin/withdrawals/wd_none/status",
                     json={"status": "paid"}, headers=auth(admin_token))
        assert r.status_code == 404
