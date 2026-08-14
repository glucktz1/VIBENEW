"""Artist portal — separate email/password accounts for singers/artists.

Faithful port of Gracefy's Choir/Singer portal, renamed to "Artists".
Auth follows the JWT playbook: separate `artists` collection, pending-approval
gate (login 403 until approved), status re-checked on every request.
Earnings & withdrawals are simulated (real payout gateway to be added later).
"""
import os
import uuid
from datetime import timedelta
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from pymongo.errors import DuplicateKeyError
from starlette.concurrency import run_in_threadpool

from db import db, now_utc
from auth_utils import hash_password, verify_password, JWT_SECRET, JWT_ALGORITHM, TOKEN_MINUTES, require_admin
from storage import put_object, get_object, APP_NAME

router = APIRouter(prefix="/api/artists", tags=["artists"])
bearer = HTTPBearer(auto_error=False)

PER_PLAY_RATE = 50  # simulated TZS earned per play
CURRENCY = "TZS"


# ---------------- models ----------------
class ArtistRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=100)
    phone: str = ""
    bio: str = ""
    genre: str = ""


class ArtistLogin(BaseModel):
    email: EmailStr
    password: str = ""


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    genre: Optional[str] = None
    thumbnail: Optional[str] = None


class AlbumIn(BaseModel):
    title: str = Field(min_length=1)
    description: str = ""
    thumbnail: str = ""


class SongIn(BaseModel):
    title: str = Field(min_length=1)
    album_id: str
    audio_url: str
    duration: Optional[int] = None


class WithdrawIn(BaseModel):
    amount: int = Field(gt=0)
    method: str = "mobile_money"
    details: str = ""


def public_artist(a: dict) -> dict:
    return {
        "artist_id": a["artist_id"],
        "email": a["email"],
        "name": a.get("name", ""),
        "phone": a.get("phone", ""),
        "bio": a.get("bio", ""),
        "genre": a.get("genre", ""),
        "thumbnail": a.get("thumbnail"),
        "status": a.get("status", "pending"),
        "total_withdrawn": a.get("total_withdrawn", 0),
    }


def issue_artist_token(artist_id: str) -> str:
    now = now_utc()
    payload = {"sub": artist_id, "typ": "artist", "iat": now, "exp": now + timedelta(minutes=TOKEN_MINUTES)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_artist(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> dict:
    unauth = HTTPException(status_code=401, detail="Invalid or expired token", headers={"WWW-Authenticate": "Bearer"})
    if not creds:
        raise unauth
    try:
        claims = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if claims.get("typ") != "artist" or not claims.get("sub"):
            raise unauth
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        raise unauth
    artist = await db.artists.find_one({"artist_id": claims["sub"]})
    if not artist or artist.get("status") != "approved":
        raise unauth
    return artist


# ---------------- auth ----------------
@router.post("/register")
async def register(body: ArtistRegister):
    doc = {
        "artist_id": f"art_{uuid.uuid4().hex[:12]}",
        "email": str(body.email).lower().strip(),
        "name": body.name.strip(),
        "password_hash": hash_password(body.password),
        "phone": body.phone.strip(),
        "bio": body.bio.strip(),
        "genre": body.genre.strip(),
        "thumbnail": None,
        "status": "pending",
        "total_withdrawn": 0,
        "created_at": now_utc(),
    }
    try:
        await db.artists.insert_one(dict(doc))
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Barua pepe hii tayari imesajiliwa")
    return {"ok": True, "status": "pending", "message": "Ombi lako limepokelewa. Subiri idhini ya admin.", "artist": public_artist(doc)}


@router.post("/login")
async def login(body: ArtistLogin):
    email = str(body.email).lower().strip()
    artist = await db.artists.find_one({"email": email})
    if not artist or not verify_password(body.password, artist.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Barua pepe au nywila si sahihi")
    if artist.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Akaunti yako bado inasubiri idhini ya admin")
    token = issue_artist_token(artist["artist_id"])
    return {"access_token": token, "token_type": "bearer", "artist": public_artist(artist)}


@router.get("/me")
async def me(artist: dict = Depends(get_current_artist)):
    return public_artist(artist)


@router.put("/me")
async def update_me(body: ProfileUpdate, artist: dict = Depends(get_current_artist)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        await db.artists.update_one({"artist_id": artist["artist_id"]}, {"$set": updates})
    updated = await db.artists.find_one({"artist_id": artist["artist_id"]})
    return public_artist(updated)


# ---------------- content ----------------
@router.get("/albums")
async def my_albums(artist: dict = Depends(get_current_artist)):
    return await db.albums.find({"artist_id": artist["artist_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.post("/albums")
async def create_album(body: AlbumIn, artist: dict = Depends(get_current_artist)):
    doc = {
        "album_id": f"alb_{uuid.uuid4().hex[:12]}",
        "title": body.title,
        "artist_name": artist.get("name"),
        "artist_id": artist["artist_id"],
        "description": body.description,
        "thumbnail": body.thumbnail or "https://picsum.photos/seed/vibe/400",
        "monetization_type": "free",
        "status": "pending",  # awaits admin approval
        "songs_count": 0,
        "total_plays": 0,
        "created_at": now_utc(),
    }
    await db.albums.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.get("/songs")
async def my_songs(artist: dict = Depends(get_current_artist)):
    return await db.songs.find({"artist_id": artist["artist_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/songs")
async def create_song(body: SongIn, artist: dict = Depends(get_current_artist)):
    album = await db.albums.find_one({"album_id": body.album_id, "artist_id": artist["artist_id"]})
    if not album:
        raise HTTPException(status_code=404, detail="Albamu haijapatikana")
    doc = {
        "song_id": f"song_{uuid.uuid4().hex[:12]}",
        "title": body.title,
        "album_id": body.album_id,
        "artist_id": artist["artist_id"],
        "artist_name": artist.get("name"),
        "audio_url": body.audio_url,
        "duration": body.duration,
        "track_number": album.get("songs_count", 0) + 1,
        "plays": 0,
        "likes": 0,
        "status": "pending",
        "thumbnail": album.get("thumbnail"),
        "created_at": now_utc(),
    }
    await db.songs.insert_one(dict(doc))
    await db.albums.update_one({"album_id": body.album_id}, {"$inc": {"songs_count": 1}})
    doc.pop("_id", None)
    return doc


# ---------------- audio upload / serve ----------------
@router.post("/upload-audio")
async def upload_audio(file: UploadFile = File(...), artist: dict = Depends(get_current_artist)):
    data = await file.read()
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Faili ni kubwa mno (kiwango cha juu 25MB)")
    ext = (file.filename or "audio.mp3").rsplit(".", 1)[-1].lower()
    path = f"{APP_NAME}/uploads/{artist['artist_id']}/{uuid.uuid4().hex}.{ext}"
    ct = file.content_type or "audio/mpeg"
    try:
        await run_in_threadpool(put_object, path, data, ct)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upakiaji umeshindikana: {e}")
    return {"path": path, "media_url": f"/api/artists/media/{path}"}


@router.get("/media/{path:path}")
async def serve_media(path: str):
    """Public playback endpoint (uuid path is unguessable) so expo-audio can stream directly."""
    try:
        content, ct = await run_in_threadpool(get_object, path)
    except Exception:
        raise HTTPException(status_code=404, detail="Media haijapatikana")
    return Response(content=content, media_type=ct, headers={"Cache-Control": "public, max-age=86400", "Accept-Ranges": "bytes"})


# ---------------- earnings & withdrawals ----------------
async def _earnings_summary(artist: dict) -> dict:
    song_ids = await db.songs.find({"artist_id": artist["artist_id"]}, {"_id": 0, "song_id": 1}).to_list(1000)
    ids = [s["song_id"] for s in song_ids]
    total_plays = await db.play_events.count_documents({"song_id": {"$in": ids}}) if ids else 0
    total_earned = total_plays * PER_PLAY_RATE
    total_withdrawn = artist.get("total_withdrawn", 0)
    pend = await db.withdrawals.find({"artist_id": artist["artist_id"], "status": "pending"}, {"_id": 0, "amount": 1}).to_list(100)
    pending = sum(w.get("amount", 0) for w in pend)
    available = max(0, total_earned - total_withdrawn - pending)
    return {
        "currency": CURRENCY,
        "per_play_rate": PER_PLAY_RATE,
        "total_plays": total_plays,
        "total_earned": total_earned,
        "total_withdrawn": total_withdrawn,
        "pending": pending,
        "available": available,
    }


@router.get("/earnings")
async def earnings(artist: dict = Depends(get_current_artist)):
    return await _earnings_summary(artist)


@router.get("/withdrawals")
async def my_withdrawals(artist: dict = Depends(get_current_artist)):
    rows = await db.withdrawals.find({"artist_id": artist["artist_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for r in rows:
        if r.get("created_at"):
            r["created_at"] = str(r["created_at"])
    return rows


@router.post("/withdrawals")
async def request_withdrawal(body: WithdrawIn, artist: dict = Depends(get_current_artist)):
    summary = await _earnings_summary(artist)
    if body.amount > summary["available"]:
        raise HTTPException(status_code=400, detail="Kiasi kinazidi salio linalopatikana")
    doc = {
        "withdrawal_id": f"wd_{uuid.uuid4().hex[:12]}",
        "artist_id": artist["artist_id"],
        "artist_name": artist.get("name"),
        "amount": body.amount,
        "method": body.method,
        "details": body.details,
        "status": "pending",
        "currency": CURRENCY,
        "created_at": now_utc(),
    }
    await db.withdrawals.insert_one(dict(doc))
    doc.pop("_id", None)
    doc["created_at"] = str(doc["created_at"])
    return doc


# ================= Admin management (require_admin) =================
class StatusIn(BaseModel):
    status: str


@router.get("/admin/all")
async def admin_list_artists(admin: dict = Depends(require_admin)):
    rows = await db.artists.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    for r in rows:
        if r.get("created_at"):
            r["created_at"] = str(r["created_at"])
        r["songs_count"] = await db.songs.count_documents({"artist_id": r["artist_id"]})
    return rows


@router.post("/admin/{artist_id}/status")
async def admin_set_artist_status(artist_id: str, body: StatusIn, admin: dict = Depends(require_admin)):
    if body.status not in ("pending", "approved", "rejected", "suspended"):
        raise HTTPException(status_code=400, detail="Invalid status")
    res = await db.artists.update_one({"artist_id": artist_id}, {"$set": {"status": body.status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Artist not found")
    return {"ok": True, "status": body.status}


@router.get("/admin/withdrawals/all")
async def admin_list_withdrawals(admin: dict = Depends(require_admin)):
    rows = await db.withdrawals.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for r in rows:
        if r.get("created_at"):
            r["created_at"] = str(r["created_at"])
    return rows


@router.post("/admin/withdrawals/{withdrawal_id}/status")
async def admin_set_withdrawal_status(withdrawal_id: str, body: StatusIn, admin: dict = Depends(require_admin)):
    if body.status not in ("pending", "approved", "paid", "rejected"):
        raise HTTPException(status_code=400, detail="Invalid status")
    wd = await db.withdrawals.find_one({"withdrawal_id": withdrawal_id})
    if not wd:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    await db.withdrawals.update_one({"withdrawal_id": withdrawal_id}, {"$set": {"status": body.status}})
    # When marked paid, add to artist total_withdrawn
    if body.status == "paid" and wd.get("status") != "paid":
        await db.artists.update_one({"artist_id": wd["artist_id"]}, {"$inc": {"total_withdrawn": wd.get("amount", 0)}})
    return {"ok": True, "status": body.status}
