"""Consumer 'me' endpoints — free listening-hours tracking & enforcement."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from db import db, now_utc
from auth_utils import get_current_user

router = APIRouter(prefix="/api/me", tags=["me"])


def _to_dt(v):
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    if isinstance(v, str):
        try:
            return datetime.fromisoformat(v.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _status(user: dict) -> dict:
    sub = user.get("subscription") if isinstance(user.get("subscription"), dict) else None
    is_free_hours = bool(sub and sub.get("type") == "free_hours")
    hours = float(user.get("free_listening_hours") or 0)
    expires = _to_dt(user.get("free_listening_expires"))
    now = now_utc()
    expired = bool(expires and now >= expires)
    cap_seconds = int(hours * 3600)
    used = int(user.get("free_hours_used_seconds") or 0)
    remaining = max(0, cap_seconds - used)
    has_grant = is_free_hours and not expired and cap_seconds > 0
    return {
        "has_grant": has_grant,
        "free_hours": hours,
        "period": user.get("free_listening_period"),
        "expires_at": str(expires) if expires else None,
        "expired": expired,
        "cap_seconds": cap_seconds,
        "used_seconds": used,
        "remaining_seconds": remaining if has_grant else 0,
        "exhausted": has_grant and remaining <= 0,
    }


@router.get("/free-hours")
async def free_hours(user: dict = Depends(get_current_user)):
    st = _status(user)
    # lazily downgrade an expired free-hours grant
    if st["expired"] and (user.get("subscription") or {}).get("type") == "free_hours":
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"is_premium": False, "subscription": None}})
    return st


class ConsumeIn(BaseModel):
    seconds: float


@router.post("/free-hours/consume")
async def consume(body: ConsumeIn, user: dict = Depends(get_current_user)):
    st = _status(user)
    if not st["has_grant"]:
        return st
    add = max(0, int(body.seconds))
    if add:
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"free_hours_used_seconds": add}})
        fresh = await db.users.find_one({"_id": user["_id"]})
        st = _status(fresh)
    return st
