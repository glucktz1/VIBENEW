from fastapi import APIRouter, HTTPException, Depends
from db import db, now_utc
from auth_utils import get_optional_user

router = APIRouter(prefix="/api/neno-la-leo", tags=["neno-la-leo"])


@router.get("/active")
async def active_entries():
    """Neno la Leo (Today's Word) — active devotional entries."""
    entries = await db.neno_entries.find(
        {"status": "published"}, {"_id": 0}
    ).sort("publish_date", -1).limit(30).to_list(30)
    for e in entries:
        leader = await db.leaders.find_one({"leader_id": e.get("leader_id")}, {"_id": 0, "name": 1, "photo": 1, "title": 1})
        if leader:
            e["leader_name"] = leader.get("name")
            e["leader_photo"] = leader.get("photo")
            e["leader_title"] = leader.get("title")
    return entries


@router.get("/{entry_id}")
async def get_entry(entry_id: str):
    e = await db.neno_entries.find_one({"entry_id": entry_id}, {"_id": 0})
    if not e:
        raise HTTPException(status_code=404, detail="Entry not found")
    leader = await db.leaders.find_one({"leader_id": e.get("leader_id")}, {"_id": 0, "name": 1, "photo": 1, "title": 1})
    if leader:
        e["leader_name"] = leader.get("name")
        e["leader_photo"] = leader.get("photo")
        e["leader_title"] = leader.get("title")
    return e


@router.post("/{entry_id}/play")
async def track_play(entry_id: str, kind: str = "reading", user=Depends(get_optional_user)):
    field = "reading_plays" if kind == "reading" else "reflection_plays"
    await db.neno_entries.update_one({"entry_id": entry_id}, {"$inc": {field: 1, "total_plays": 1}})
    return {"ok": True}
