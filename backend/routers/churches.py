from fastapi import APIRouter, HTTPException
from db import db

router = APIRouter(prefix="/api/churches", tags=["churches"])


@router.get("")
async def list_churches():
    churches = await db.churches.find({"status": "approved"}, {"_id": 0}).sort("followers_count", -1).to_list(100)
    return churches


@router.get("/{church_id}")
async def get_church(church_id: str):
    church = await db.churches.find_one({"church_id": church_id}, {"_id": 0})
    if not church:
        raise HTTPException(status_code=404, detail="Church not found")
    announcements = await db.church_announcements.find(
        {"church_id": church_id}, {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    church["announcements"] = announcements
    return church
