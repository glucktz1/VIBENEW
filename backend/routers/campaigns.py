"""Marketing Campaigns — audience targeting + (simulated) SMS/Push/Email sending.

Admins filter users by activity (inactive 7/30/90 days), by content (listened /
not-listened to a song or album), by plan and location, or hand-pick users, then
preview the real matching customer list and dispatch a campaign. SMS delivery is
currently SIMULATED (no gateway wired) — messages are logged, not actually sent.
"""
import uuid
from typing import Optional, List
from datetime import timedelta
from datetime import timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from db import db, now_utc
from auth_utils import require_admin

router = APIRouter(prefix="/api/admin", tags=["marketing-campaigns"])


def _aware(dt):
    """Motor returns tz-naive UTC datetimes; coerce to aware for safe comparison."""
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


class AudienceFilter(BaseModel):
    plan: str = "all"                       # all | free | premium
    country: Optional[str] = None
    region: Optional[str] = None
    activity: str = "all"                   # all | inactive_7 | inactive_30 | inactive_90 | active_7
    content_mode: str = "any"               # any | listened | not_listened
    content_type: Optional[str] = None      # song | album
    content_id: Optional[str] = None
    content_label: Optional[str] = None     # human label for display
    user_ids: List[str] = Field(default_factory=list)  # explicit selection overrides filters


class MarketingCampaignIn(BaseModel):
    name: str
    type: str = "sms"                       # sms | push | email | in_app
    title: Optional[str] = ""
    body: str
    description: Optional[str] = ""
    filter: AudienceFilter = Field(default_factory=AudienceFilter)
    schedule_at: Optional[str] = None


async def _resolve_song_ids(content_type: Optional[str], content_id: Optional[str]) -> set:
    if not content_id:
        return set()
    if content_type == "song":
        return {content_id}
    if content_type == "album":
        rows = await db.songs.find({"album_id": content_id}, {"_id": 0, "song_id": 1}).to_list(2000)
        return {r["song_id"] for r in rows}
    return set()


async def _build_audience(f: AudienceFilter) -> List[dict]:
    users = await db.users.find({"role": {"$in": ["customer", "user"]}}, {"password_hash": 0}).to_list(5000)

    # last-active per user (max play_event timestamp)
    last_map: dict = {}
    agg = await db.play_events.aggregate([
        {"$match": {"user_id": {"$ne": None}}},
        {"$group": {"_id": "$user_id", "last": {"$max": "$created_at"}}},
    ]).to_list(100000)
    for a in agg:
        last_map[a["_id"]] = a["last"]

    # listeners set for content filter
    listeners: Optional[set] = None
    if f.content_mode in ("listened", "not_listened") and f.content_id:
        sids = await _resolve_song_ids(f.content_type, f.content_id)
        if sids:
            rows = await db.play_events.aggregate([
                {"$match": {"song_id": {"$in": list(sids)}, "user_id": {"$ne": None}}},
                {"$group": {"_id": "$user_id"}},
            ]).to_list(100000)
            listeners = {r["_id"] for r in rows}
        else:
            listeners = set()

    now = now_utc()
    explicit = set(f.user_ids or [])
    out: List[dict] = []
    for u in users:
        uid = str(u.get("_id"))
        if explicit:
            if uid not in explicit:
                continue
        else:
            is_prem = bool(u.get("is_premium"))
            if f.plan == "free" and is_prem:
                continue
            if f.plan == "premium" and not is_prem:
                continue
            if f.country and f.country != "all" and (u.get("country") or "") != f.country:
                continue
            if f.region and f.region != "all" and (u.get("region") or "") != f.region:
                continue
            la = _aware(last_map.get(uid))
            if f.activity.startswith("inactive_"):
                days = int(f.activity.split("_")[1])
                cutoff = now - timedelta(days=days)
                if la is not None and la >= cutoff:
                    continue
            elif f.activity.startswith("active_"):
                days = int(f.activity.split("_")[1])
                cutoff = now - timedelta(days=days)
                if la is None or la < cutoff:
                    continue
            if listeners is not None:
                if f.content_mode == "listened" and uid not in listeners:
                    continue
                if f.content_mode == "not_listened" and uid in listeners:
                    continue
        la = last_map.get(uid)
        out.append({
            "user_id": uid,
            "name": u.get("name") or u.get("email"),
            "email": u.get("email"),
            "phone": u.get("phone") or "",
            "plan": "Premium" if u.get("is_premium") else "Free",
            "country": u.get("country") or "Tanzania",
            "region": u.get("region") or "",
            "last_active": str(la) if la else None,
        })
    out.sort(key=lambda x: (x["last_active"] or ""), reverse=True)
    return out


@router.post("/audience/preview")
async def audience_preview(f: AudienceFilter, admin: dict = Depends(require_admin)):
    users = await _build_audience(f)
    with_phone = sum(1 for u in users if u["phone"])
    return {"total": len(users), "with_phone": with_phone, "users": users}


@router.get("/content-search")
async def content_search(q: str = "", admin: dict = Depends(require_admin)):
    q = (q or "").strip()
    if len(q) < 1:
        return {"albums": [], "songs": []}
    rgx = {"$regex": q, "$options": "i"}
    albums = await db.albums.find(
        {"title": rgx}, {"_id": 0, "album_id": 1, "title": 1, "artist_name": 1, "thumbnail": 1}
    ).limit(10).to_list(10)
    songs = await db.songs.find(
        {"title": rgx}, {"_id": 0, "song_id": 1, "title": 1, "artist_name": 1, "album_id": 1, "thumbnail": 1}
    ).limit(10).to_list(10)
    return {"albums": albums, "songs": songs}


@router.get("/marketing-campaigns")
async def list_marketing_campaigns(admin: dict = Depends(require_admin)):
    rows = await db.marketing_campaigns.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    summary = {
        "total": len(rows),
        "sent": sum(1 for r in rows if r.get("status") == "sent"),
        "scheduled": sum(1 for r in rows if r.get("status") == "scheduled"),
        "recipients": sum(int(r.get("recipient_count") or 0) for r in rows),
    }
    return {"summary": summary, "campaigns": rows}


@router.post("/marketing-campaigns")
async def create_marketing_campaign(body: MarketingCampaignIn, admin: dict = Depends(require_admin)):
    users = await _build_audience(body.filter)
    if body.type == "sms":
        recipients = [u for u in users if u["phone"]]
    else:
        recipients = users
    status = "scheduled" if body.schedule_at else "sent"
    doc = {
        "campaign_id": f"mc_{uuid.uuid4().hex[:10]}",
        "name": body.name,
        "type": body.type,
        "title": body.title or "",
        "body": body.body,
        "description": body.description or "",
        "filter": body.filter.model_dump(),
        "recipient_count": len(recipients),
        "recipient_sample": [
            {"name": u["name"], "phone": u["phone"], "email": u["email"]} for u in recipients[:100]
        ],
        "status": status,
        "schedule_at": body.schedule_at,
        "created_at": now_utc(),
        "sent_at": None if status == "scheduled" else now_utc(),
        "delivery": "simulated",
    }
    await db.marketing_campaigns.insert_one(dict(doc))
    doc.pop("_id", None)
    return {"ok": True, "sent": len(recipients) if status == "sent" else 0, "campaign": doc}


@router.delete("/marketing-campaigns/{campaign_id}")
async def delete_marketing_campaign(campaign_id: str, admin: dict = Depends(require_admin)):
    await db.marketing_campaigns.delete_one({"campaign_id": campaign_id})
    return {"ok": True}
