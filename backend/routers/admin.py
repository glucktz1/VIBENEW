from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List
from starlette.concurrency import run_in_threadpool
import uuid

from db import db, now_utc
from auth_utils import require_admin
from storage import put_object, get_object, APP_NAME
from bson import ObjectId
from bson.errors import InvalidId
from datetime import timedelta, datetime, timezone

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


class SongUpdate(BaseModel):
    title: Optional[str] = None
    audio_url: Optional[str] = None
    status: Optional[str] = None


@router.put("/songs/{song_id}")
async def update_song(song_id: str, body: SongUpdate, admin: dict = Depends(require_admin)):
    update = {k: v for k, v in body.dict().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    if "status" in update and update["status"] not in ("active", "inactive"):
        raise HTTPException(status_code=400, detail="Invalid status")
    res = await db.songs.update_one({"song_id": song_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Song not found")
    return {"ok": True, **update}


@router.patch("/songs/{song_id}/status")
async def song_status(song_id: str, body: dict, admin: dict = Depends(require_admin)):
    status = body.get("status")
    if status not in ("active", "inactive"):
        raise HTTPException(status_code=400, detail="Invalid status")
    res = await db.songs.update_one({"song_id": song_id}, {"$set": {"status": status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Song not found")
    return {"ok": True, "status": status}


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
def _uid(user: dict) -> str:
    return str(user.get("_id"))


def _register_by(user: dict) -> str:
    return "Mobile No" if user.get("phone") else "Email"


def _membership(user: dict) -> str:
    return "Premium" if user.get("is_premium") else "Free"


def _status(user: dict) -> str:
    if user.get("disabled"):
        return "suspended"
    return user.get("status") or "active"


async def _find_user_by_id(user_id: str) -> Optional[dict]:
    try:
        return await db.users.find_one({"_id": ObjectId(user_id)})
    except (InvalidId, TypeError):
        return await db.users.find_one({"user_id": user_id})


def _channel(user: dict) -> str:
    sub = user.get("subscription")
    if isinstance(sub, dict) and sub.get("channel"):
        return sub.get("channel")
    ch = user.get("register_channel")
    if ch:
        return ch
    plat = (user.get("platform") or "").lower()
    if plat == "web":
        return "web"
    if plat in ("android", "ios"):
        return "app"
    return "app"


def _region(user: dict) -> str:
    c = user.get("country") or "Tanzania"
    r = user.get("region")
    return f"{c} / {r}" if r else c


@router.get("/users")
async def list_users(
    search: Optional[str] = None,
    membership_type: Optional[str] = None,   # all | Free | Premium
    status: Optional[str] = None,             # all | active | suspended
    country: Optional[str] = None,            # all | <country>
    registered_from: Optional[str] = None,    # ISO date
    registered_to: Optional[str] = None,      # ISO date
    admin: dict = Depends(require_admin),
):
    query: dict = {"role": {"$in": ["customer", "user"]}}
    if search:
        query["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]
    if country and country != "all":
        query["country"] = country
    if registered_from or registered_to:
        rng: dict = {}
        try:
            if registered_from:
                rng["$gte"] = datetime.fromisoformat(registered_from).replace(tzinfo=timezone.utc)
            if registered_to:
                rng["$lte"] = datetime.fromisoformat(registered_to).replace(tzinfo=timezone.utc) + timedelta(days=1)
        except ValueError:
            rng = {}
        if rng:
            query["created_at"] = rng
    users = await db.users.find(query, {"password_hash": 0}).sort("created_at", -1).limit(1000).to_list(1000)

    # last-active per user from play_events (one aggregation)
    last_map: dict = {}
    agg = await db.play_events.aggregate([
        {"$match": {"user_id": {"$ne": None}}},
        {"$group": {"_id": "$user_id", "last": {"$max": "$created_at"}}},
    ]).to_list(100000)
    for a in agg:
        last_map[a["_id"]] = a["last"]

    out = []
    for u in users:
        uid = _uid(u)
        sub = u.get("subscription") or {}
        subscribed_at = sub.get("granted_at") if isinstance(sub, dict) else None
        row = {
            "user_id": uid,
            "id": u.get("email"),
            "name": u.get("name"),
            "email": u.get("email"),
            "mobile": u.get("phone") or "",
            "country": u.get("country") or "Tanzania",
            "region": u.get("region") or "",
            "country_region": _region(u),
            "channel": _channel(u),
            "membership_type": _membership(u),
            "current_plan": sub.get("plan_name") if isinstance(sub, dict) else None,
            "subscribed_at": str(subscribed_at) if subscribed_at else None,
            "plan_expiry": str(sub.get("expires_at")) if isinstance(sub, dict) and sub.get("expires_at") else None,
            "last_active": str(last_map.get(uid)) if last_map.get(uid) else None,
            "status": _status(u),
            "is_premium": bool(u.get("is_premium")),
            "created_at": str(u.get("created_at")) if u.get("created_at") else None,
        }
        if membership_type and membership_type != "all" and row["membership_type"] != membership_type:
            continue
        if status and status != "all" and row["status"] != status:
            continue
        out.append(row)
    return out


@router.get("/users/countries")
async def user_countries(admin: dict = Depends(require_admin)):
    vals = await db.users.distinct("country", {"role": {"$in": ["customer", "user"]}})
    return sorted([v for v in vals if v])


class BulkActionIn(BaseModel):
    user_ids: List[str]
    action: str   # activate | deactivate | delete


@router.post("/users/bulk-action")
async def users_bulk_action(body: BulkActionIn, admin: dict = Depends(require_admin)):
    if body.action not in ("activate", "deactivate", "delete"):
        raise HTTPException(status_code=400, detail="Invalid action")
    oids = []
    for uid in body.user_ids:
        try:
            oids.append(ObjectId(uid))
        except (InvalidId, TypeError):
            pass
    if not oids:
        return {"ok": True, "affected": 0}
    flt = {"_id": {"$in": oids}, "role": {"$in": ["customer", "user"]}}
    if body.action == "delete":
        res = await db.users.delete_many(flt)
        return {"ok": True, "affected": res.deleted_count}
    disabled = body.action == "deactivate"
    res = await db.users.update_many(flt, {"$set": {"disabled": disabled, "status": "suspended" if disabled else "active"}})
    return {"ok": True, "affected": res.modified_count}


@router.get("/users/stats/summary")
async def user_stats_summary(admin: dict = Depends(require_admin)):
    base = {"role": {"$in": ["customer", "user"]}}
    total = await db.users.count_documents(base)
    suspended = await db.users.count_documents({**base, "disabled": True})
    premium = await db.users.count_documents({**base, "is_premium": True})
    active = total - suspended
    free = total - premium
    trial = await db.users.count_documents({**base, "subscription.trial": True})
    return {
        "total_users": total,
        "active": active,
        "premium": premium,
        "free": free,
        "trial": trial,
        "suspended": suspended,
    }


@router.get("/users/{user_id}")
async def get_user_detail(user_id: str, admin: dict = Depends(require_admin)):
    u = await _find_user_by_id(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    uid = _uid(u)
    total_plays = await db.play_events.count_documents({"user_id": uid})
    tx = await db.transactions.find({"user_id": uid}, {"_id": 0, "amount": 1, "status": 1}).to_list(1000)
    total_spent = sum(t.get("amount", 0) for t in tx if t.get("status") == "completed")
    downloads_count = await db.downloads.count_documents({"user_id": uid})
    liked = len(u.get("liked_songs") or [])
    sub = u.get("subscription") if isinstance(u.get("subscription"), dict) else None
    last_ev = await db.play_events.find_one({"user_id": uid}, {"_id": 0, "created_at": 1}, sort=[("created_at", -1)])
    return {
        "user_id": uid,
        "name": u.get("name"),
        "email": u.get("email"),
        "phone": u.get("phone"),
        "mobile": u.get("phone") or "",
        "country": u.get("country") or "Tanzania",
        "region": u.get("region") or "",
        "country_region": _region(u),
        "channel": _channel(u),
        "membership_type": _membership(u),
        "status": _status(u),
        "is_premium": bool(u.get("is_premium")),
        "created_at": str(u.get("created_at")) if u.get("created_at") else None,
        "subscribed_at": str(sub.get("granted_at")) if sub and sub.get("granted_at") else None,
        "last_active": str(last_ev.get("created_at")) if last_ev and last_ev.get("created_at") else None,
        "subscription": sub,
        "device": {
            "platform": u.get("platform"),
            "manufacturer": u.get("device_manufacturer"),
            "model": u.get("device_model"),
            "os_version": u.get("os_version"),
        },
        "analytics": {
            "total_plays": total_plays,
            "total_spent": total_spent,
            "downloads_count": downloads_count,
            "liked_songs_count": liked,
            "transactions_count": len(tx),
        },
    }


@router.get("/users/{user_id}/listening-history")
async def user_listening_history(user_id: str, limit: int = 50, admin: dict = Depends(require_admin)):
    u = await _find_user_by_id(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    uid = _uid(u)
    events = await db.play_events.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    history = []
    for e in events:
        song = await db.songs.find_one({"song_id": e.get("song_id")}, {"_id": 0, "title": 1, "artist_name": 1, "thumbnail": 1, "duration": 1})
        history.append({
            "song_id": e.get("song_id"),
            "song_title": (song or {}).get("title") or "Unknown Track",
            "artist_name": (song or {}).get("artist_name") or "Unknown Artist",
            "thumbnail": (song or {}).get("thumbnail"),
            "duration": (song or {}).get("duration"),
            "is_guest": e.get("is_guest", False),
            "listened_at": str(e.get("created_at")) if e.get("created_at") else None,
        })
    total = await db.play_events.count_documents({"user_id": uid})
    return {"history": history, "total": total}


@router.get("/users/{user_id}/downloads")
async def user_downloads(user_id: str, admin: dict = Depends(require_admin)):
    u = await _find_user_by_id(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    uid = _uid(u)
    rows = await db.downloads.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    out = []
    for d in rows:
        song = await db.songs.find_one({"song_id": d.get("song_id")}, {"_id": 0, "title": 1, "artist_name": 1, "thumbnail": 1})
        out.append({
            "song_id": d.get("song_id"),
            "title": (song or {}).get("title") or "Unknown Track",
            "artist_name": (song or {}).get("artist_name") or "Unknown Artist",
            "thumbnail": (song or {}).get("thumbnail"),
            "downloaded_at": str(d.get("created_at")) if d.get("created_at") else None,
        })
    return {"downloads": out, "total": len(out)}


@router.get("/users/{user_id}/transactions")
async def user_transactions(user_id: str, admin: dict = Depends(require_admin)):
    u = await _find_user_by_id(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    uid = _uid(u)
    rows = await db.transactions.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    for r in rows:
        if r.get("created_at"):
            r["created_at"] = str(r["created_at"])
        r["gateway"] = r.get("gateway", "azampay_simulated")
    total_spent = sum(r.get("amount", 0) for r in rows if r.get("status") == "completed")
    return {"transactions": rows, "total": len(rows), "total_spent": total_spent}


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None


@router.put("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdate, admin: dict = Depends(require_admin)):
    u = await _find_user_by_id(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    upd = {k: v for k, v in body.dict().items() if v is not None}
    if not upd:
        raise HTTPException(status_code=400, detail="Nothing to update")
    await db.users.update_one({"_id": u["_id"]}, {"$set": upd})
    return {"ok": True, **upd}


@router.patch("/users/{user_id}/status")
async def set_user_status(user_id: str, body: dict, admin: dict = Depends(require_admin)):
    status = body.get("status")
    if status not in ("active", "suspended", "inactive"):
        raise HTTPException(status_code=400, detail="Invalid status")
    u = await _find_user_by_id(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    disabled = status in ("suspended", "inactive")
    await db.users.update_one({"_id": u["_id"]}, {"$set": {"disabled": disabled, "status": "active" if not disabled else "suspended"}})
    return {"ok": True, "status": "active" if not disabled else "suspended"}


@router.post("/users/{user_id}/reset")
async def reset_user(user_id: str, admin: dict = Depends(require_admin)):
    """Reset a user's usage counters & subscription back to Free (faithful to Gracefy 'reset')."""
    u = await _find_user_by_id(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.update_one({"_id": u["_id"]}, {"$set": {
        "is_premium": False,
        "subscription": None,
        "guest_plays": 0,
        "skip_count": 0,
    }})
    return {"ok": True}


# -------- Admin subscription / free-hours enrollment --------
DURATION_PRESETS = {"daily": 1, "3days": 3, "weekly": 7, "monthly": 30}


class EnrollIn(BaseModel):
    mode: str                              # "plan" | "free_hours"
    user_ids: List[str] = []
    phones: List[str] = []
    duration_days: Optional[int] = None    # plan mode
    plan_name: Optional[str] = None        # plan mode label (e.g. "Weekly")
    free_hours: Optional[float] = None     # free_hours mode
    free_period: Optional[str] = None      # "day" | "week" | "month"


@router.post("/enroll")
async def enroll_users(body: EnrollIn, admin: dict = Depends(require_admin)):
    if body.mode not in ("plan", "free_hours"):
        raise HTTPException(status_code=400, detail="Invalid mode")

    # resolve duration window
    period_days = {"day": 1, "week": 7, "month": 30}
    if body.mode == "plan":
        days = body.duration_days or 7
    else:
        if not body.free_hours or body.free_hours <= 0:
            raise HTTPException(status_code=400, detail="free_hours required")
        days = period_days.get((body.free_period or "week"), 7)
    expires_at = now_utc() + timedelta(days=days)

    # build subscription payload
    if body.mode == "plan":
        sub = {
            "plan_name": body.plan_name or f"{days}-Day Plan",
            "granted_by": admin.get("email"),
            "granted_at": now_utc(),
            "expires_at": expires_at,
            "type": "admin_plan",
            "channel": "admin",
        }
        user_set = {"is_premium": True, "subscription": sub}
    else:
        sub = {
            "plan_name": f"{body.free_hours}h free / {body.free_period or 'week'}",
            "granted_by": admin.get("email"),
            "granted_at": now_utc(),
            "expires_at": expires_at,
            "type": "free_hours",
            "channel": "admin",
            "free_hours": body.free_hours,
            "free_period": body.free_period or "week",
        }
        user_set = {
            "is_premium": True,
            "subscription": sub,
            "free_listening_hours": body.free_hours,
            "free_listening_period": body.free_period or "week",
            "free_listening_expires": expires_at,
        }

    targets = []
    applied = 0

    # by explicit user_ids
    for uid in body.user_ids:
        u = await _find_user_by_id(uid)
        if u:
            await db.users.update_one({"_id": u["_id"]}, {"$set": user_set})
            targets.append({"user_id": uid, "email": u.get("email"), "status": "applied"})
            applied += 1
        else:
            targets.append({"user_id": uid, "status": "not_found"})

    # by phone numbers (bulk upload) — match existing, else record pending
    for raw in body.phones:
        phone = str(raw).strip()
        if not phone:
            continue
        u = await db.users.find_one({"phone": phone})
        if u:
            await db.users.update_one({"_id": u["_id"]}, {"$set": user_set})
            targets.append({"phone": phone, "email": u.get("email"), "status": "applied"})
            applied += 1
        else:
            # keep pending grant so it applies whenever this phone registers
            await db.pending_enrollments.update_one(
                {"phone": phone},
                {"$set": {"phone": phone, "grant": user_set, "created_at": now_utc(), "granted_by": admin.get("email")}},
                upsert=True,
            )
            targets.append({"phone": phone, "status": "pending"})

    record = {
        "enrollment_id": f"enr_{uuid.uuid4().hex[:12]}",
        "admin_email": admin.get("email"),
        "mode": body.mode,
        "duration_days": days,
        "plan_name": sub["plan_name"],
        "free_hours": body.free_hours,
        "free_period": body.free_period,
        "expires_at": str(expires_at),
        "targets": targets,
        "applied_count": applied,
        "pending_count": sum(1 for t in targets if t["status"] == "pending"),
        "total_count": len(targets),
        "created_at": now_utc(),
    }
    await db.enrollments.insert_one(dict(record))
    record.pop("_id", None)
    record["created_at"] = str(record["created_at"])
    return record


@router.get("/enrollments")
async def list_enrollments(admin: dict = Depends(require_admin)):
    rows = await db.enrollments.find({}, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    for r in rows:
        if r.get("created_at"):
            r["created_at"] = str(r["created_at"])
    return rows


@router.post("/enrollments/{enrollment_id}/revoke")
async def revoke_enrollment(enrollment_id: str, admin: dict = Depends(require_admin)):
    rec = await db.enrollments.find_one({"enrollment_id": enrollment_id})
    if not rec:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    if rec.get("status") == "revoked":
        return {"ok": True, "already": True}
    clear = {
        "is_premium": False,
        "subscription": None,
        "free_listening_hours": None,
        "free_listening_period": None,
        "free_listening_expires": None,
        "free_hours_used_seconds": 0,
    }
    revoked = 0
    for t in rec.get("targets", []):
        if t.get("status") != "applied":
            if t.get("phone"):
                await db.pending_enrollments.delete_one({"phone": t["phone"]})
            continue
        u = None
        if t.get("user_id"):
            u = await _find_user_by_id(t["user_id"])
        elif t.get("email"):
            u = await db.users.find_one({"email": t["email"]})
        elif t.get("phone"):
            u = await db.users.find_one({"phone": t["phone"]})
        if u:
            await db.users.update_one({"_id": u["_id"]}, {"$set": clear})
            revoked += 1
    await db.enrollments.update_one(
        {"enrollment_id": enrollment_id},
        {"$set": {"status": "revoked", "revoked_by": admin.get("email"), "revoked_at": now_utc(), "revoked_count": revoked}},
    )
    return {"ok": True, "revoked_count": revoked}


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


# -------- Song management under albums (single/bulk, upload, HLS status) --------
class SongItem(BaseModel):
    title: str
    audio_url: str
    duration: Optional[int] = None
    source: str = "cdn"          # cdn | upload


class BulkSongs(BaseModel):
    songs: List[SongItem]


def _hls_for(source: str, audio_url: str) -> dict:
    """HLS encoding pipeline. Real segment transcoding is done by Bunny Stream (auto)
    when configured; until then CDN links are 'ready' and uploads are marked 'ready'
    served progressively. hls_url mirrors the source so playback works everywhere."""
    return {"hls_status": "ready", "hls_url": audio_url, "encoding_source": source}


async def _add_song(album: dict, item: SongItem) -> dict:
    doc = {
        "song_id": f"song_{uuid.uuid4().hex[:12]}",
        "title": item.title,
        "album_id": album["album_id"],
        "artist_id": album.get("artist_id"),
        "artist_name": album.get("artist_name"),
        "audio_url": item.audio_url,
        "duration": item.duration,
        "track_number": album.get("songs_count", 0) + 1,
        "plays": 0,
        "likes": 0,
        "status": "active",
        "thumbnail": album.get("thumbnail"),
        "created_at": now_utc(),
        **_hls_for(item.source, item.audio_url),
    }
    await db.songs.insert_one(dict(doc))
    await db.albums.update_one({"album_id": album["album_id"]}, {"$inc": {"songs_count": 1}})
    doc.pop("_id", None)
    if doc.get("created_at"):
        doc["created_at"] = str(doc["created_at"])
    return doc


@router.get("/albums/{album_id}/songs")
async def album_songs(album_id: str, admin: dict = Depends(require_admin)):
    rows = await db.songs.find({"album_id": album_id}, {"_id": 0}).sort("track_number", 1).to_list(500)
    for r in rows:
        if r.get("created_at"):
            r["created_at"] = str(r["created_at"])
        r.setdefault("hls_status", "ready")
    return rows


@router.post("/albums/{album_id}/songs")
async def add_album_song(album_id: str, item: SongItem, admin: dict = Depends(require_admin)):
    album = await db.albums.find_one({"album_id": album_id})
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    return await _add_song(album, item)


@router.post("/albums/{album_id}/songs/bulk")
async def add_album_songs_bulk(album_id: str, body: BulkSongs, admin: dict = Depends(require_admin)):
    album = await db.albums.find_one({"album_id": album_id})
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    created = []
    for it in body.songs:
        album = await db.albums.find_one({"album_id": album_id})  # refresh songs_count
        created.append(await _add_song(album, it))
    return {"created": len(created), "songs": created}


@router.post("/upload-audio")
async def admin_upload_audio(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    data = await file.read()
    if len(data) > 30 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 30MB)")
    ext = (file.filename or "audio.mp3").rsplit(".", 1)[-1].lower()
    path = f"{APP_NAME}/uploads/admin/{uuid.uuid4().hex}.{ext}"
    try:
        await run_in_threadpool(put_object, path, data, file.content_type or "audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {e}")
    return {"path": path, "media_url": f"/api/artists/media/{path}"}


HOME_ROWS = [
    {"id": "pick_week", "title": "Pick of the Week"},
    {"id": "country_fav", "title": "Maarufu (Country)"},
    {"id": "recommended", "title": "Made for You"},
    {"id": "recently_added", "title": "Recently Added"},
    {"id": "artists", "title": "Wasanii Maarufu"},
    {"id": "trending", "title": "Trending Now"},
    {"id": "new", "title": "New Releases"},
]


@router.get("/home-layout")
async def get_home_layout(admin: dict = Depends(require_admin)):
    cfg = await db.app_config.find_one({"key": "home_layout"}, {"_id": 0})
    rows = (cfg or {}).get("value")
    if not rows:
        rows = [{**r, "enabled": True} for r in HOME_ROWS]
    return {"rows": rows}


@router.put("/home-layout")
async def set_home_layout(body: dict, admin: dict = Depends(require_admin)):
    rows = body.get("rows") or []
    await db.app_config.update_one({"key": "home_layout"}, {"$set": {"key": "home_layout", "value": rows}}, upsert=True)
    return {"ok": True, "rows": rows}



DEFAULT_PILL_NAMES = ["Bongo Hits", "Gospel", "R&B", "Amapiano", "Taarabu"]


def _default_pill_ids(cats: list) -> list:
    ids = []
    for name in DEFAULT_PILL_NAMES:
        for c in cats:
            if (c.get("name") or "").strip().lower() == name.lower() and c["category_id"] not in ids:
                ids.append(c["category_id"]); break
    return ids


@router.get("/home-genres")
async def get_home_genres(admin: dict = Depends(require_admin)):
    cats = await db.categories.find({"status": {"$ne": "inactive"}}, {"_id": 0}).sort("sort_order", 1).to_list(200)
    cfg = await db.app_config.find_one({"key": "home_genres"}, {"_id": 0})
    selected = (cfg or {}).get("value")
    if not selected:
        selected = _default_pill_ids(cats)
    return {"categories": cats, "selected": selected}


@router.put("/home-genres")
async def set_home_genres(body: dict, admin: dict = Depends(require_admin)):
    ids = body.get("category_ids") or []
    await db.app_config.update_one({"key": "home_genres"}, {"$set": {"key": "home_genres", "value": ids}}, upsert=True)
    return {"ok": True, "category_ids": ids}
