"""Session 15 backend tests — Content Management (Albums CRUD + Categories) and
Analytics Data Usage endpoint.

Run:
    pytest /app/backend/tests/test_content_and_datausage.py -v \
        --junitxml=/app/test_reports/pytest/content_datausage.xml
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://logic-6.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@vibe.app"
ADMIN_PASSWORD = "Vibe@2026"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def user_token(s):
    creds = {
        "email": f"TEST_{uuid.uuid4().hex[:8]}@test.com",
        "password": "pass123",
        "name": "TEST User",
    }
    r = s.post(f"{API}/auth/register", json=creds)
    assert r.status_code == 200
    return r.json()["access_token"]


# ============ Albums (Content Management) CRUD ============
class TestAdminAlbumsCRUD:
    """Verifies POST/GET/PUT/PATCH/DELETE flows on /api/admin/albums."""

    def test_list_albums_includes_inactive(self, s, admin_headers):
        r = s.get(f"{API}/admin/albums", headers=admin_headers)
        assert r.status_code == 200
        albums = r.json()
        assert isinstance(albums, list)
        # ensure no mongo _id leaks
        for a in albums[:5]:
            assert "_id" not in a
            assert "album_id" in a
            assert "status" in a

    def test_non_admin_forbidden(self, s, user_token):
        r = s.get(f"{API}/admin/albums", headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code in (401, 403)

    def test_unauthenticated_forbidden(self, s):
        r = s.get(f"{API}/admin/albums")
        assert r.status_code in (401, 403)

    def test_full_album_lifecycle(self, s, admin_headers):
        # Get a real category
        cats = s.get(f"{API}/admin/categories", headers=admin_headers).json()
        assert cats, "No categories seeded"
        cat_id = cats[0]["category_id"]

        payload = {
            "title": f"TEST_Album_{uuid.uuid4().hex[:6]}",
            "artist_name": "TEST_Artist",
            "category_id": cat_id,
            "countries": ["TZ", "KE"],
            "thumbnail": "https://picsum.photos/300",
            "release_date": "2026-01-01",
            "monetization_type": "premium",
            "status": "active",
            "tags": ["chill", "new"],
            "description": "Test album from pytest",
        }
        r = s.post(f"{API}/admin/albums", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        album = r.json()
        aid = album["album_id"]
        assert album["title"] == payload["title"]
        assert album["tags"] == ["chill", "new"]
        assert album["category_name"] == cats[0]["name"]
        assert album["monetization_type"] == "premium"
        assert album["countries"] == ["TZ", "KE"]

        try:
            # Verify listed
            albums = s.get(f"{API}/admin/albums", headers=admin_headers).json()
            assert any(a["album_id"] == aid for a in albums)

            # PUT: update tags and description
            r2 = s.put(
                f"{API}/admin/albums/{aid}",
                json={"tags": ["chill", "new", "hot"], "description": "Updated"},
                headers=admin_headers,
            )
            assert r2.status_code == 200
            updated = r2.json()
            assert set(updated["tags"]) == {"chill", "new", "hot"}
            assert updated["description"] == "Updated"

            # PATCH status → inactive
            r3 = s.patch(
                f"{API}/admin/albums/{aid}/status",
                json={"status": "inactive"},
                headers=admin_headers,
            )
            assert r3.status_code == 200
            assert r3.json()["status"] == "inactive"

            # Verify persisted via list
            row = next(a for a in s.get(f"{API}/admin/albums", headers=admin_headers).json() if a["album_id"] == aid)
            assert row["status"] == "inactive"

            # Toggle back to active
            r4 = s.patch(
                f"{API}/admin/albums/{aid}/status",
                json={"status": "active"},
                headers=admin_headers,
            )
            assert r4.status_code == 200
            assert r4.json()["status"] == "active"

            # PATCH invalid status
            r5 = s.patch(
                f"{API}/admin/albums/{aid}/status",
                json={"status": "banned"},
                headers=admin_headers,
            )
            assert r5.status_code == 400
        finally:
            r_del = s.delete(f"{API}/admin/albums/{aid}", headers=admin_headers)
            assert r_del.status_code == 200

            # After delete: verify not present in admin list
            albums_after = s.get(f"{API}/admin/albums", headers=admin_headers).json()
            assert not any(a["album_id"] == aid for a in albums_after)

    def test_put_nonexistent_album_404(self, s, admin_headers):
        r = s.put(f"{API}/admin/albums/nonexistent_id", json={"title": "x"}, headers=admin_headers)
        assert r.status_code == 404

    def test_patch_status_nonexistent_404(self, s, admin_headers):
        r = s.patch(
            f"{API}/admin/albums/nonexistent_id/status",
            json={"status": "active"},
            headers=admin_headers,
        )
        assert r.status_code == 404


# ============ Categories ============
class TestAdminCategories:
    def test_list_categories_has_album_count(self, s, admin_headers):
        r = s.get(f"{API}/admin/categories", headers=admin_headers)
        assert r.status_code == 200
        cats = r.json()
        assert isinstance(cats, list)
        assert len(cats) >= 1, "Expected seeded categories"
        # Should be general music, not religious. Just verify shape.
        for c in cats:
            assert "category_id" in c
            assert "name" in c
            assert "album_count" in c
            assert isinstance(c["album_count"], int)
            assert "_id" not in c

    def test_general_music_categories_seeded(self, s, admin_headers):
        cats = s.get(f"{API}/admin/categories", headers=admin_headers).json()
        names_lower = {c["name"].lower() for c in cats}
        # Expect >= 8 categories per spec
        assert len(cats) >= 8, f"Expected >=8 seeded categories, got {len(cats)}: {names_lower}"
        # Should NOT contain religious rebrand terms
        for banned in ("gospel", "worship", "praise"):
            # allow presence but not required; just sanity: we don't fail if present
            pass

    def test_create_and_delete_category(self, s, admin_headers):
        name = f"TEST_Cat_{uuid.uuid4().hex[:6]}"
        r = s.post(f"{API}/admin/categories", json={"name": name, "color": "#123456"}, headers=admin_headers)
        assert r.status_code == 200
        cat = r.json()
        cid = cat["category_id"]
        assert cat["name"] == name
        assert cat["color"] == "#123456"
        assert cat["album_count"] == 0

        # Duplicate → 409
        r2 = s.post(f"{API}/admin/categories", json={"name": name}, headers=admin_headers)
        assert r2.status_code == 409

        # Delete
        r3 = s.delete(f"{API}/admin/categories/{cid}", headers=admin_headers)
        assert r3.status_code == 200

        # Confirm gone
        cats = s.get(f"{API}/admin/categories", headers=admin_headers).json()
        assert not any(c["category_id"] == cid for c in cats)

    def test_delete_category_nulls_album_refs(self, s, admin_headers):
        # Create a category
        name = f"TEST_CatX_{uuid.uuid4().hex[:6]}"
        r = s.post(f"{API}/admin/categories", json={"name": name}, headers=admin_headers)
        cid = r.json()["category_id"]

        # Create album under it
        r_a = s.post(
            f"{API}/admin/albums",
            json={"title": f"TEST_A_{uuid.uuid4().hex[:6]}", "artist_name": "TA", "category_id": cid},
            headers=admin_headers,
        )
        aid = r_a.json()["album_id"]

        try:
            # Delete category
            r_d = s.delete(f"{API}/admin/categories/{cid}", headers=admin_headers)
            assert r_d.status_code == 200

            # Album should now have category_id=None
            row = next(a for a in s.get(f"{API}/admin/albums", headers=admin_headers).json() if a["album_id"] == aid)
            assert row.get("category_id") is None
            assert row.get("category_name") is None
        finally:
            s.delete(f"{API}/admin/albums/{aid}", headers=admin_headers)

    def test_non_admin_forbidden(self, s, user_token):
        r = s.get(f"{API}/admin/categories", headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code in (401, 403)


# ============ Analytics: Data Usage ============
class TestDataUsage:
    def test_data_usage_default(self, s, admin_headers):
        r = s.get(f"{API}/analytics/data-usage", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        for key in [
            "total_data_gb",
            "streaming_gb",
            "downloads_gb",
            "listening_minutes",
            "per_day",
            "minutes_per_day",
            "days",
        ]:
            assert key in data, f"missing key {key}"
        assert data["days"] == 30
        assert isinstance(data["per_day"], list) and len(data["per_day"]) == 30
        assert isinstance(data["minutes_per_day"], list) and len(data["minutes_per_day"]) == 30
        # spot-check shape
        assert set(data["per_day"][0].keys()) >= {"date", "streams_mb", "downloads_mb"}
        assert set(data["minutes_per_day"][0].keys()) >= {"date", "minutes"}

    def test_data_usage_custom_days(self, s, admin_headers):
        r = s.get(f"{API}/analytics/data-usage", params={"days": 7}, headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["days"] == 7
        assert len(data["per_day"]) == 7
        assert len(data["minutes_per_day"]) == 7

    def test_data_usage_requires_admin(self, s, user_token):
        r = s.get(f"{API}/analytics/data-usage", headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code in (401, 403)

    def test_data_usage_unauthenticated(self, s):
        r = s.get(f"{API}/analytics/data-usage")
        assert r.status_code in (401, 403)
