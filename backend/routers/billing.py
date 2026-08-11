"""Billing & monetization — faithful port of Gracefy's rules (payment simulated).

Guest users: GUEST_PLAY_LIMIT / GUEST_SKIP_LIMIT (independent of billing) -> login prompt.
Logged-in non-premium: tiered skips 6 -> +3 -> +3 -> disable + 15s preview mode
    (preview pattern: 15s, 15s, 15s, FULL, repeat).
Premium / billing OFF: no restrictions.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import timedelta

from db import db, now_utc
from auth_utils import get_current_user

router = APIRouter(prefix="/api", tags=["billing"])

GUEST_PLAY_LIMIT = 5
GUEST_SKIP_LIMIT = 5

# Tiered skip limits for logged-in non-premium users
SKIP_TIER_1 = 6      # free skips before first prompt
SKIP_TIER_2 = 3      # additional after first prompt
SKIP_TIER_3 = 3      # additional after second prompt -> then disabled + preview mode
PREVIEW_SECONDS = 15  # non-premium preview cutoff
PREVIEW_PATTERN = [15, 15, 15, 0]  # 0 == full song


class SubscribeIn(BaseModel):
    plan_id: str
    phone: str = ""  # simulated Azam Pay mobile-money number


@router.get("/billing-status")
async def billing_status():
    cfg = await db.app_config.find_one({"key": "billing"}, {"_id": 0})
    enabled = cfg.get("value", True) if cfg else True
    return {
        "billing_enabled": enabled,
        "guest_play_limit": GUEST_PLAY_LIMIT,
        "guest_skip_limit": GUEST_SKIP_LIMIT,
        "skip_tiers": [SKIP_TIER_1, SKIP_TIER_2, SKIP_TIER_3],
        "preview_seconds": PREVIEW_SECONDS,
        "preview_pattern": PREVIEW_PATTERN,
    }


@router.get("/subscription-plans")
async def subscription_plans():
    plans = await db.subscription_plans.find({"status": "active"}, {"_id": 0}).sort("price", 1).to_list(50)
    return plans


@router.post("/payment/azampay/initiate")
async def initiate_payment(body: SubscribeIn, user: dict = Depends(get_current_user)):
    """Simulated mobile-money payment: returns success immediately and activates plan."""
    plan = await db.subscription_plans.find_one({"plan_id": body.plan_id, "status": "active"})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    starts = now_utc()
    expires = starts + timedelta(days=int(plan.get("duration_days", 30)))
    subscription = {
        "plan_id": plan["plan_id"],
        "plan_name": plan.get("name"),
        "price": plan.get("price"),
        "currency": plan.get("currency", "TZS"),
        "started_at": starts.isoformat(),
        "expires_at": expires.isoformat(),
        "status": "active",
        "phone": body.phone,
        "gateway": "azampay_simulated",
    }
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"is_premium": True, "subscription": subscription}},
    )
    await db.transactions.insert_one({
        "user_id": str(user["_id"]),
        "plan_id": plan["plan_id"],
        "amount": plan.get("price"),
        "currency": plan.get("currency", "TZS"),
        "phone": body.phone,
        "status": "completed",
        "created_at": now_utc(),
    })
    return {
        "success": True,
        "message": "Malipo yamekamilika. Karibu Premium!",  # Payment complete. Welcome to Premium!
        "subscription": subscription,
    }


@router.post("/subscription/cancel")
async def cancel_subscription(user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"is_premium": False, "subscription": None}},
    )
    return {"ok": True}
