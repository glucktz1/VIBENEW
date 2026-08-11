"""Focused auth-only test suite for the reported 'login problem'.

Covers:
- POST /api/auth/register: new email 200, duplicate 409
- POST /api/auth/login:
    * admin empty password 200
    * admin correct password 200
    * fresh user correct password 200
    * wrong password 401
    * empty password for non-admin user 401
- GET /api/auth/me: bearer 200 with correct user; missing 401; invalid 401
"""

import os
import uuid

import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "admin@vibe.app"
ADMIN_PASS = "Vibe@2026"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def fresh_user(api):
    email = f"loginbug+{uuid.uuid4().hex[:8]}@test.com"
    password = "pass123"
    r = api.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": password, "name": "Login Bug"},
    )
    assert r.status_code == 200, r.text
    j = r.json()
    return {"email": email, "password": password, "token": j["access_token"], "user": j["user"]}


# ---------------- Register ----------------

class TestRegister:
    def test_register_new_returns_token(self, api):
        email = f"TEST_reg_{uuid.uuid4().hex[:8]}@test.com"
        r = api.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": email, "password": "pass123", "name": "Reg User"},
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["token_type"] == "bearer"
        assert j["access_token"]
        assert j["user"]["email"] == email.lower()
        assert j["user"]["role"] == "customer"
        assert j["user"]["is_premium"] is False

    def test_register_duplicate_409(self, api, fresh_user):
        r = api.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": fresh_user["email"],
                "password": "pass123",
                "name": "Dupe",
            },
        )
        assert r.status_code == 409, r.text


# ---------------- Login ----------------

class TestLogin:
    def test_admin_empty_password_ok(self, api):
        r = api.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ""},
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["access_token"]
        assert j["user"]["role"] in ("admin", "moderator", "content_manager")
        assert j["user"]["email"] == ADMIN_EMAIL

    def test_admin_correct_password_ok(self, api):
        r = api.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
        )
        assert r.status_code == 200, r.text
        assert r.json()["user"]["email"] == ADMIN_EMAIL

    def test_user_correct_password_ok(self, api, fresh_user):
        r = api.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": fresh_user["email"], "password": fresh_user["password"]},
        )
        assert r.status_code == 200, r.text
        assert r.json()["user"]["email"] == fresh_user["email"]

    def test_user_wrong_password_401(self, api, fresh_user):
        r = api.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": fresh_user["email"], "password": "WRONG_pw"},
        )
        assert r.status_code == 401, r.text

    def test_user_empty_password_401(self, api, fresh_user):
        # non-admin must NOT succeed with empty password
        r = api.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": fresh_user["email"], "password": ""},
        )
        assert r.status_code == 401, r.text


# ---------------- /me ----------------

class TestMe:
    def test_me_with_valid_bearer(self, api, fresh_user):
        r = api.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {fresh_user['token']}"},
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["email"] == fresh_user["email"]
        assert j["id"] == fresh_user["user"]["id"]

    def test_me_missing_token_401(self, api):
        r = requests.get(f"{BASE_URL}/api/auth/me")  # no default headers
        assert r.status_code == 401

    def test_me_invalid_token_401(self, api):
        r = api.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer not-a-jwt"},
        )
        assert r.status_code == 401
