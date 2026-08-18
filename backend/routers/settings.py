"""Admin platform config: Settings, Advertising campaigns, Recommendation engine.

Faithful port of Gracefy's AdminSettings / Advertising / RecommendationEngine pages.
All values persist in Mongo so toggles/config survive restarts.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db import db, now_utc
from auth_utils import require_admin

router = APIRouter(prefix="/api/admin", tags=["admin-config"])

# ---------------- Settings ----------------
DEFAULT_SETTINGS = {
    "key": "app",
    "premium_for_all": False,
    "billing_enabled": True,
    "no_ads_for_premium": True,
    "min_play_duration": 30,          # seconds counted as a play
    "replay_limit_per_song": 3,       # free users
    "background_playback": True,
    "free_unlimited_downloads": False,
    "free_unlimited_songs": False,
    "phone_otp_enabled": False,
    "free_user_skip_limit": 6,
    "free_user_daily_songs": 20,
    "guest_play_limit": 3,
    "free_prompt_ringtone_pct": 50,   # % of times FREE users see ringtone prompt vs contribute
    # Branding
    "app_name": "Vibe",
    "brand_primary_color": "#00A8E8",
    "support_email": "support@vibe.app",
    # Legal & Compliance
    "company_name": "Vibe Music",
    "terms_url": "",
    "privacy_url": "",
    # Auth
    "email_verification_required": False,
    # Security
    "two_factor_admin": False,
    "session_timeout_min": 60,
}


@router.get("/settings")
async def get_settings(admin: dict = Depends(require_admin)):
    doc = await db.settings.find_one({"key": "app"}, {"_id": 0})
    if not doc:
        doc = dict(DEFAULT_SETTINGS)
        await db.settings.insert_one(dict(doc))
    return {**DEFAULT_SETTINGS, **doc}


@router.put("/settings")
async def update_settings(body: dict, admin: dict = Depends(require_admin)):
    updates = {k: v for k, v in body.items() if k in DEFAULT_SETTINGS and k != "key"}
    await db.settings.update_one({"key": "app"}, {"$set": updates}, upsert=True)
    doc = await db.settings.find_one({"key": "app"}, {"_id": 0})
    return {**DEFAULT_SETTINGS, **doc}


# ---------------- Translations (i18n) ----------------
@router.get("/translations")
async def get_translations_admin(admin: dict = Depends(require_admin)):
    doc = await db.app_config.find_one({"key": "translations"}, {"_id": 0})
    return (doc or {}).get("value", {})


@router.put("/translations")
async def set_translations(body: dict, admin: dict = Depends(require_admin)):
    # body is the full translations map: { "en": {...}, "sw": {...}, "<code>": {...} }
    payload = body.get("translations", body) if isinstance(body, dict) else {}
    clean = {str(k): {str(kk): str(vv) for kk, vv in (v or {}).items()} for k, v in payload.items() if isinstance(v, dict)}
    await db.app_config.update_one({"key": "translations"}, {"$set": {"value": clean}}, upsert=True)
    return {"ok": True, "languages": list(clean.keys()), "value": clean}



# ---------------- Advertising campaigns ----------------
class CampaignIn(BaseModel):
    title: str
    type: str = "banner"           # banner | interstitial | audio
    image_url: str = ""
    target_url: str = ""
    placement: str = "home"        # home | player | search
    status: str = "active"         # active | paused | ended


@router.get("/campaigns")
async def list_campaigns(admin: dict = Depends(require_admin)):
    rows = await db.campaigns.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for r in rows:
        if r.get("created_at"):
            r["created_at"] = str(r["created_at"])
    summary = {
        "total": len(rows),
        "active": sum(1 for r in rows if r.get("status") == "active"),
        "impressions": sum(r.get("impressions", 0) for r in rows),
        "clicks": sum(r.get("clicks", 0) for r in rows),
    }
    return {"summary": summary, "campaigns": rows}


@router.post("/campaigns")
async def create_campaign(body: CampaignIn, admin: dict = Depends(require_admin)):
    doc = {
        "campaign_id": f"cmp_{uuid.uuid4().hex[:10]}",
        **body.model_dump(),
        "impressions": 0,
        "clicks": 0,
        "created_at": now_utc(),
    }
    await db.campaigns.insert_one(dict(doc))
    doc.pop("_id", None)
    doc["created_at"] = str(doc["created_at"])
    return doc


@router.patch("/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, body: dict, admin: dict = Depends(require_admin)):
    allowed = {"title", "type", "image_url", "target_url", "placement", "status"}
    updates = {k: v for k, v in body.items() if k in allowed}
    res = await db.campaigns.update_one({"campaign_id": campaign_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"ok": True}


@router.delete("/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str, admin: dict = Depends(require_admin)):
    await db.campaigns.delete_one({"campaign_id": campaign_id})
    return {"ok": True}


# ---------------- Recommendation engine ----------------
DEFAULT_RECS = {
    "key": "recs",
    "enabled": True,
    "algorithm": "hybrid",            # trending | collaborative | hybrid
    "trending_weight": 40,
    "recency_weight": 30,
    "personalization_weight": 30,
    "max_recommendations": 20,
    "include_new_artists": True,
    "boost_local_content": True,
}


@router.get("/recommendations")
async def get_recs(admin: dict = Depends(require_admin)):
    doc = await db.rec_config.find_one({"key": "recs"}, {"_id": 0})
    if not doc:
        doc = dict(DEFAULT_RECS)
        await db.rec_config.insert_one(dict(doc))
    return {**DEFAULT_RECS, **doc}


@router.put("/recommendations")
async def update_recs(body: dict, admin: dict = Depends(require_admin)):
    updates = {k: v for k, v in body.items() if k in DEFAULT_RECS and k != "key"}
    await db.rec_config.update_one({"key": "recs"}, {"$set": updates}, upsert=True)
    doc = await db.rec_config.find_one({"key": "recs"}, {"_id": 0})
    return {**DEFAULT_RECS, **doc}
