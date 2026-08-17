"""Backend tests for the new home layout feature:
- GET /api/home returns recommended, pick_week, recently_added sections
- GET /api/admin/home-layout requires admin & returns rows
- PUT /api/admin/home-layout persists and GET /api/home reflects it
  (disabled hidden, enabled reordered)

At the end we RESET home_layout back to all-enabled default so the demo
home page isn't left with hidden rows.
"""
import os
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://logic-6.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "admin@vibe.app"
ADMIN_PASSWORD = "Vibe@2026"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"no token in login resp: {data}"
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------- /api/home baseline ----------
class TestHomeSections:
    def test_home_ok(self):
        r = requests.get(f"{BASE}/api/home", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "sections" in body
        assert isinstance(body["sections"], list)

    def test_home_contains_new_rows(self):
        r = requests.get(f"{BASE}/api/home", timeout=15)
        body = r.json()
        ids = [s["id"] for s in body["sections"]]
        # These 3 curated rows must be present in default layout
        for rid in ("recommended", "pick_week", "recently_added"):
            assert rid in ids, f"missing section id '{rid}'. got: {ids}"

    def test_home_section_shapes(self):
        r = requests.get(f"{BASE}/api/home", timeout=15)
        body = r.json()
        by_id = {s["id"]: s for s in body["sections"]}
        rec = by_id.get("recommended")
        pw = by_id.get("pick_week")
        ra = by_id.get("recently_added")
        assert rec and rec.get("type") == "recommended" and rec.get("title") == "Made for You"
        assert pw and pw.get("type") == "pick_week" and pw.get("title") == "Pick of the Week"
        assert ra and ra.get("type") == "albums" and ra.get("title") == "Recently Added"


# ---------- /api/admin/home-layout auth ----------
class TestHomeLayoutAuth:
    def test_requires_auth(self):
        r = requests.get(f"{BASE}/api/admin/home-layout", timeout=15)
        assert r.status_code in (401, 403)

    def test_get_returns_rows(self, admin_headers):
        r = requests.get(f"{BASE}/api/admin/home-layout", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "rows" in body and isinstance(body["rows"], list)
        assert len(body["rows"]) > 0
        # each row shape
        for row in body["rows"]:
            assert "id" in row and "title" in row
        ids = [r["id"] for r in body["rows"]]
        for rid in ("recommended", "pick_week", "recently_added"):
            assert rid in ids


# ---------- PUT /api/admin/home-layout -> /api/home reflection ----------
class TestHomeLayoutMutation:
    """Core flow: PUT rows, verify GET /home reflects (order + disabled filter)."""

    def test_put_reorder_and_disable_reflects_in_home(self, admin_headers):
        # Custom layout: pick_week first, hide trending, hide 'new'
        rows = [
            {"id": "pick_week", "title": "Pick of the Week", "enabled": True},
            {"id": "recommended", "title": "Made for You", "enabled": True},
            {"id": "recently_added", "title": "Recently Added", "enabled": True},
            {"id": "trending", "title": "Trending Now", "enabled": False},
            {"id": "new", "title": "New Releases", "enabled": False},
            {"id": "artists", "title": "Wasanii Maarufu", "enabled": True},
        ]
        pr = requests.put(f"{BASE}/api/admin/home-layout", headers=admin_headers, json={"rows": rows}, timeout=15)
        assert pr.status_code == 200, pr.text
        assert pr.json().get("ok") is True

        # GET /api/home should reflect it
        hr = requests.get(f"{BASE}/api/home", timeout=15)
        assert hr.status_code == 200
        got_ids = [s["id"] for s in hr.json()["sections"]]

        # disabled rows must be absent
        assert "trending" not in got_ids, f"'trending' should be hidden. got: {got_ids}"
        assert "new" not in got_ids, f"'new' should be hidden. got: {got_ids}"

        # enabled rows must be in the exact configured order among themselves
        enabled_order = ["pick_week", "recommended", "recently_added"]
        # keep only those known ids from what we got
        known_in_got = [i for i in got_ids if i in enabled_order]
        assert known_in_got == enabled_order, f"ordering not respected: {known_in_got} vs {enabled_order}"

    def test_reset_to_all_enabled_default(self, admin_headers):
        """Cleanup — restore all-enabled default so demo home isn't left with hidden rows."""
        gr = requests.get(f"{BASE}/api/admin/home-layout", headers=admin_headers, timeout=15)
        assert gr.status_code == 200
        # Rebuild an all-enabled version using the same ids/titles the backend advertises
        rows = [{**r, "enabled": True} for r in gr.json()["rows"]]
        # canonical order (matches HOME_ROWS in admin.py)
        canonical = ["recommended", "pick_week", "recently_added", "artists", "trending", "new"]
        rows.sort(key=lambda r: canonical.index(r["id"]) if r["id"] in canonical else 999)
        pr = requests.put(f"{BASE}/api/admin/home-layout", headers=admin_headers, json={"rows": rows}, timeout=15)
        assert pr.status_code == 200

        # verify home is normal again — trending / new visible again
        hr = requests.get(f"{BASE}/api/home", timeout=15)
        got_ids = [s["id"] for s in hr.json()["sections"]]
        for must in ("recommended", "pick_week", "recently_added"):
            assert must in got_ids
        # trending & new should be back
        assert ("trending" in got_ids) or ("new" in got_ids), (
            f"expected trending/new to be restored after reset. got: {got_ids}"
        )
