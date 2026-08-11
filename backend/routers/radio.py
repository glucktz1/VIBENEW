from fastapi import APIRouter, HTTPException, Depends
from db import db, now_utc
from auth_utils import get_optional_user

router = APIRouter(prefix="/api", tags=["radio"])


@router.get("/radio")
async def list_radio():
    stations = await db.radio_stations.find({"status": "active"}, {"_id": 0}).sort("sort_order", 1).to_list(100)
    return stations


@router.get("/radio/{station_id}")
async def get_radio(station_id: str):
    st = await db.radio_stations.find_one({"station_id": station_id}, {"_id": 0})
    if not st:
        raise HTTPException(status_code=404, detail="Station not found")
    return st


@router.post("/radio/{station_id}/play")
async def track_radio_play(station_id: str, user=Depends(get_optional_user)):
    await db.radio_stations.update_one({"station_id": station_id}, {"$inc": {"listeners": 1}})
    return {"ok": True}
