"""Emergent Managed Object Storage helpers (audio uploads for artist portal).

The Expo app never talks to storage directly — it POSTs files to our FastAPI
routes, which use these helpers. EMERGENT_LLM_KEY lives only in backend/.env.
"""
import os

import requests

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "vibe"

_storage_key = None

# ---------------- Bunny CDN (primary for new media uploads) ----------------
BUNNY_ZONE = (os.environ.get("BUNNY_STORAGE_ZONE") or "").strip()
BUNNY_PASSWORD = (os.environ.get("BUNNY_STORAGE_PASSWORD") or "").strip()
BUNNY_ENDPOINT = (os.environ.get("BUNNY_STORAGE_ENDPOINT") or "https://storage.bunnycdn.com").strip().rstrip("/")
BUNNY_PULL_HOST = (os.environ.get("BUNNY_PULL_ZONE_HOST") or "").strip().rstrip("/")

BUNNY_ENABLED = bool(BUNNY_ZONE and BUNNY_PASSWORD and BUNNY_PULL_HOST)


def bunny_put_object(path: str, data: bytes, content_type: str) -> str:
    """Upload raw bytes to Bunny Storage Zone (PUT). Returns the public Pull Zone URL.

    `path` is a server-generated key like 'vibe/uploads/<artist>/<uuid>.mp3'.
    """
    clean = path.lstrip("/")
    url = f"{BUNNY_ENDPOINT}/{BUNNY_ZONE}/{clean}"
    resp = requests.put(
        url,
        headers={"AccessKey": BUNNY_PASSWORD, "Content-Type": content_type},
        data=data,
        timeout=180,
    )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Bunny upload failed HTTP {resp.status_code}: {resp.text[:200]}")
    return f"https://{BUNNY_PULL_HOST}/{clean}"


def init_storage():
    """Call once at startup. Idempotent — returns a reusable storage_key."""
    global _storage_key
    if _storage_key:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def _reset_key():
    global _storage_key
    _storage_key = None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Upload bytes. Returns {"path","size","etag"}. Retries once on stale key (503)."""
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    if resp.status_code == 503:
        _reset_key()
        key = init_storage()
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    """Download. Returns (content_bytes, content_type)."""
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 503:
        _reset_key()
        key = init_storage()
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")
