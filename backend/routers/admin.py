from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import uuid

from db import db, now_utc
from auth_utils import require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])


class AlbumIn(BaseModel):
    title: str
    artist_name: str
    description: Optional[str] = None
    category_id: Optional[str] = None
    thumbnail: Optional[str] = None
    tags: List[str] = []
    countries: List[str] = ["Global"]
    release_date: Optional[str] = None
    artist_id: Optional[str] = None
    status: str = "active"
    monetization_type: str = "free"


class AlbumUpdate(BaseModel):
    title: Optional[str] = None
    artist_name: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[str] = None
    thumbnail: Optional[str] = None
    tags: Optional[List[str]] = None
    countries: Optional[List[str]] = None
    release_date: Optional[str] = None
    monetization_type: Optional[str] = None
    status: Optional[str] = None


class CategoryIn(BaseModel):
    name: str
    color: Optional[str] = "#8b5cf6"


class SongIn(BaseModel):
    title: str
    album_id: str
    audio_url: str
    duration: Optional[int] = None
    track_number: Optional[int] = None
    song_categories: List[str] = []


class PlanIn(BaseModel):
    name: str
    price: int
    duration_days: int
    currency: str = "TZS"
    description: Optional[str] = None


@router.get("/stats")
async def dashboard_stats(admin: dict = Depends(require_admin)):
    total_users = await db.users.count_documents({})
    premium_users = await db.users.count_documents({"is_premium": True})
    total_songs = await db.songs.count_documents({})
    total_albums = await db.albums.count_documents({})
    total_plays = await db.play_events.count_documents({})
    total_playlists = await db.playlists.count_documents({})
    total_radio = await db.radio_stations.count_documents({})
    total_churches = await db.churches.count_documents({})
    total_neno = await db.neno_entries.count_documents({})
    total_plans = await db.subscription_plans.count_documents({"status": "active"})
    total_transactions = await db.transactions.count_documents({"status": "completed"})
    guest_plays = await db.play_events.count_documents({"is_guest": True})
    logged_plays = await db.play_events.count_documents({"is_guest": False})
    txns = await db.transactions.find({"status": "completed"}, {"_id": 0, "amount": 1}).to_list(10000)
    revenue = sum(t.get("amount", 0) for t in txns)

    top_songs = await db.songs.find({}, {"_id": 0, "song_id": 1, "title": 1, "plays": 1, "likes": 1, "album_id": 1}).sort("plays", -1).limit(5).to_list(5)
    for s in top_songs:
        alb = await db.albums.find_one({"album_id": s.get("album_id")}, {"_id": 0, "artist_name": 1})
        s["artist_name"] = alb.get("artist_name") if alb else None

    recent_txns = await db.transactions.find({"status": "completed"}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    for t in recent_txns:
        if t.get("created_at"):
            t["created_at"] = str(t["created_at"])

    return {
        "total_users": total_users,
        "premium_users": premium_users,
        "total_songs": total_songs,
        "total_albums": total_albums,
        "total_plays": total_plays,
        "total_playlists": total_playlists,
        "total_radio": total_radio,
        "total_churches": total_churches,
        "total_neno": total_neno,
        "total_plans": total_plans,
        "total_transactions": total_transactions,
        "guest_plays": guest_plays,
        "logged_plays": logged_plays,
        "revenue": revenue,
        "currency": "TZS",
        "top_songs": top_songs,
        "recent_transactions": recent_txns,
    }


@router.get("/analytics/plays")
async def plays_analytics(admin: dict = Depends(require_admin)):
    pipeline = [
        {"$group": {
            "_id": {"guest": "$is_guest"},
            "count": {"$sum": 1},
        }},
    ]
    rows = await db.play_events.aggregate(pipeline).to_list(10)
    guest = 0
    logged = 0
    for r in rows:
        if r["_id"].get("guest"):
            guest = r["count"]
        else:
            logged = r["count"]
    return {"guest_plays": guest, "logged_in_plays": logged, "total": guest + logged}


# -------- Albums CRUD --------
@router.get("/albums")
async def list_albums(admin: dict = Depends(require_admin)):
    albums = await db.albums.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return albums


@router.post("/albums")
async def create_album(body: AlbumIn, admin: dict = Depends(require_admin)):
    cat = None
    if body.category_id:
        cat = await db.categories.find_one({"category_id": body.category_id}, {"_id": 0, "name": 1})
    doc = {
        "album_id": f"alb_{uuid.uuid4().hex[:12]}",
        "title": body.title,
        "artist_name": body.artist_name,
        "artist_id": body.artist_id or f"art_{uuid.uuid4().hex[:8]}",
        "description": body.description,
        "category_id": body.category_id,
        "category_name": cat.get("name") if cat else None,
        "thumbnail": body.thumbnail,
        "tags": body.tags,
        "countries": body.countries or ["Global"],
        "release_date": body.release_date,
        "monetization_type": body.monetization_type,
        "status": body.status or "active",
        "songs_count": 0,
        "total_plays": 0,
        "created_at": now_utc(),
    }
    await db.albums.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.put("/albums/{album_id}")
async def update_album(album_id: str, body: AlbumUpdate, admin: dict = Depends(require_admin)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "category_id" in updates:
        cat = await db.categories.find_one({"category_id": updates["category_id"]}, {"_id": 0, "name": 1})
        updates["category_name"] = cat.get("name") if cat else None
    if updates:
        res = await db.albums.update_one({"album_id": album_id}, {"$set": updates})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Album not found")
    doc = await db.albums.find_one({"album_id": album_id}, {"_id": 0})
    return doc


@router.patch("/albums/{album_id}/status")
async def album_status(album_id: str, body: dict, admin: dict = Depends(require_admin)):
    status = body.get("status")
    if status not in ("active", "inactive"):
        raise HTTPException(status_code=400, detail="Invalid status")
    res = await db.albums.update_one({"album_id": album_id}, {"$set": {"status": status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Album not found")
    return {"ok": True, "status": status}


@router.delete("/albums/{album_id}")
async def delete_album(album_id: str, admin: dict = Depends(require_admin)):
    await db.albums.delete_one({"album_id": album_id})
    await db.songs.delete_many({"album_id": album_id})
    return {"ok": True}


# -------- Songs CRUD --------
@router.post("/songs")
async def create_song(body: SongIn, admin: dict = Depends(require_admin)):
    album = await db.albums.find_one({"album_id": body.album_id})
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    doc = {
        "song_id": f"song_{uuid.uuid4().hex[:12]}",
        "title": body.title,
        "album_id": body.album_id,
        "audio_url": body.audio_url,
        "duration": body.duration,
        "track_number": body.track_number or (album.get("songs_count", 0) + 1),
        "song_categories": body.song_categories,
        "plays": 0,
        "likes": 0,
        "status": "active",
        "thumbnail": album.get("thumbnail"),
        "created_at": now_utc(),
    }
    await db.songs.insert_one(dict(doc))
    await db.albums.update_one({"album_id": body.album_id}, {"$inc": {"songs_count": 1}})
    doc.pop("_id", None)
    return doc


@router.delete("/songs/{song_id}")
async def delete_song(song_id: str, admin: dict = Depends(require_admin)):
    song = await db.songs.find_one({"song_id": song_id})
    if song:
        await db.albums.update_one({"album_id": song.get("album_id")}, {"$inc": {"songs_count": -1}})
    await db.songs.delete_one({"song_id": song_id})
    return {"ok": True}


# -------- Categories --------
@router.get("/categories")
async def list_categories(admin: dict = Depends(require_admin)):
    cats = await db.categories.find({}, {"_id": 0}).sort("name", 1).to_list(200)
    for c in cats:
        c["album_count"] = await db.albums.count_documents({"category_id": c["category_id"]})
    return cats


@router.post("/categories")
async def create_category(body: CategoryIn, admin: dict = Depends(require_admin)):
    existing = await db.categories.find_one({"name": {"$regex": f"^{body.name}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=409, detail="Category already exists")
    doc = {
        "category_id": f"cat_{uuid.uuid4().hex[:8]}",
        "name": body.name.strip(),
        "color": body.color or "#8b5cf6",
        "created_at": now_utc(),
    }
    await db.categories.insert_one(dict(doc))
    doc.pop("_id", None)
    doc["album_count"] = 0
    return doc


@router.delete("/categories/{category_id}")
async def delete_category(category_id: str, admin: dict = Depends(require_admin)):
    await db.categories.delete_one({"category_id": category_id})
    await db.albums.update_many({"category_id": category_id}, {"$set": {"category_id": None, "category_name": None}})
    return {"ok": True}


# -------- Users --------
@router.get("/users")
async def list_users(admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).limit(200).to_list(200)
    for u in users:
        u["id"] = u.get("email")
    return users


# -------- Plans --------
@router.post("/plans")
async def create_plan(body: PlanIn, admin: dict = Depends(require_admin)):
    doc = {
        "plan_id": f"plan_{uuid.uuid4().hex[:8]}",
        "name": body.name,
        "price": body.price,
        "duration_days": body.duration_days,
        "currency": body.currency,
        "description": body.description,
        "status": "active",
        "created_at": now_utc(),
    }
    await db.subscription_plans.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


# -------- Billing toggle --------
@router.post("/billing-toggle")
async def toggle_billing(admin: dict = Depends(require_admin)):
    cfg = await db.app_config.find_one({"key": "billing"})
    new_val = not (cfg.get("value", True) if cfg else True)
    await db.app_config.update_one({"key": "billing"}, {"$set": {"value": new_val}}, upsert=True)
    return {"billing_enabled": new_val}


# -------- Control & Management: Roles / Approvals / Health --------
VALID_ROLES = ["customer", "content_manager", "moderator", "finance", "support", "admin"]


@router.patch("/users/{email}/role")
async def set_user_role(email: str, body: dict, admin: dict = Depends(require_admin)):
    role = body.get("role")
    if role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    res = await db.users.update_one({"email": email}, {"$set": {"role": role}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True, "role": role}


@router.get("/approvals")
async def approvals(admin: dict = Depends(require_admin)):
    artists = await db.artists.find({"status": "pending"}, {"_id": 0, "password_hash": 0}).to_list(200)
    for a in artists:
        if a.get("created_at"):
            a["created_at"] = str(a["created_at"])
    albums = await db.albums.find({"status": "pending"}, {"_id": 0}).to_list(200)
    songs = await db.songs.find({"status": "pending"}, {"_id": 0}).to_list(200)
    return {
        "summary": {"artists": len(artists), "albums": len(albums), "songs": len(songs),
                    "total": len(artists) + len(albums) + len(songs)},
        "artists": artists, "albums": albums, "songs": songs,
    }


@router.post("/approvals/album/{album_id}")
async def approve_album(album_id: str, body: dict, admin: dict = Depends(require_admin)):
    status = body.get("status", "active")
    await db.albums.update_one({"album_id": album_id}, {"$set": {"status": status}})
    return {"ok": True, "status": status}


@router.post("/approvals/song/{song_id}")
async def approve_song(song_id: str, body: dict, admin: dict = Depends(require_admin)):
    status = body.get("status", "active")
    await db.songs.update_one({"song_id": song_id}, {"$set": {"status": status}})
    return {"ok": True, "status": status}


@router.get("/health")
async def health(admin: dict = Depends(require_admin)):
    db_ok = True
    try:
        await db.command("ping")
    except Exception:
        db_ok = False
    try:
        from storage import init_storage
        init_storage()
        storage_ok = True
    except Exception:
        storage_ok = False
    return {
        "services": [
            {"name": "API Server", "status": "operational", "ok": True},
            {"name": "MongoDB", "status": "operational" if db_ok else "down", "ok": db_ok},
            {"name": "Object Storage (Audio)", "status": "operational" if storage_ok else "degraded", "ok": storage_ok},
            {"name": "Streaming CDN", "status": "operational", "ok": True},
        ],
        "counts": {
            "users": await db.users.count_documents({}),
            "artists": await db.artists.count_documents({}),
            "albums": await db.albums.count_documents({}),
            "songs": await db.songs.count_documents({}),
            "plays": await db.play_events.count_documents({}),
            "campaigns": await db.campaigns.count_documents({}),
        },
    }
