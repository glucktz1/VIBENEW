"""Billing master-switch round-trip: PUT /admin/settings <-> GET /billing-status"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/") or "http://localhost:8001"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@vibe.app"
ADMIN_PASS = "Vibe@2026"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


def _billing_status():
    r = requests.get(f"{API}/billing-status", timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _set_billing(headers, enabled: bool):
    r = requests.put(f"{API}/admin/settings", headers=headers, json={"billing_enabled": enabled}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


class TestBillingStatusShape:
    def test_public_status_has_required_keys(self):
        s = _billing_status()
        assert "billing_enabled" in s
        assert "premium_for_all" in s
        assert isinstance(s["billing_enabled"], bool)
        assert isinstance(s["premium_for_all"], bool)


class TestBillingRoundTrip:
    def test_toggle_off_reflects_in_billing_status(self, admin_headers):
        updated = _set_billing(admin_headers, False)
        assert updated.get("billing_enabled") is False
        s = _billing_status()
        assert s["billing_enabled"] is False, f"/billing-status did not reflect OFF: {s}"

    def test_toggle_on_reflects_in_billing_status(self, admin_headers):
        updated = _set_billing(admin_headers, True)
        assert updated.get("billing_enabled") is True
        s = _billing_status()
        assert s["billing_enabled"] is True, f"/billing-status did not reflect ON: {s}"

    def test_restore_off_at_end(self, admin_headers):
        # user's current desired state
        _set_billing(admin_headers, False)
        s = _billing_status()
        assert s["billing_enabled"] is False


class TestFreeUserLogin:
    def test_free_user_login(self):
        r = requests.post(f"{API}/auth/login", json={"email": "u1@test.com", "password": "pass123"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data
        assert data["user"]["email"] == "u1@test.com"
        assert data["user"].get("is_premium") in (False, None)
