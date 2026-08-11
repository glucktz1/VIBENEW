from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import uuid

from db import db, now_utc
from auth_utils import get_current_user

router = APIRouter(prefix="/api", tags=["library"])


class PlaylistIn(BaseModel):
    name: str
    description: Optional[str] = None


class SongRef(BaseModel):
    song_id: str


async def _hydrate_playlist(pl: dict) -> dict:
    pl.pop("_id", None)
    song_ids = pl.get("song_ids", [])
    songs = []
    if song_ids:
        docs = await db.songs.find({"song_id": {"$in": song_ids}}, {"_id": 0}).to_list(500)
        by_id = {s["song_id"]: s for s in docs}
        for sid in song_ids:
            s = by_id.get(sid)
            if not s:
                continue
            alb = await db.albums.find_one({"album_id": s.get("album_id")}, {"_id": 0, "title": 1, "artist_name": 1, "thumbnail": 1})
            if alb:
                s["album_title"] = alb.get("title")
                s["artist_name"] = alb.get("artist_name")
                s["thumbnail"] = s.get("thumbnail") or alb.get("thumbnail")
            songs.append(s)
    pl["songs"] = songs
    pl["songs_count"] = len(songs)
    return pl


@router.get("/playlists")
async def get_playlists(user: dict = Depends(get_current_user)):
    pls = await db.playlists.find({"user_id": str(user["_id"])}).sort("created_at", -1).to_list(200)
    return [await _hydrate_playlist(p) for p in pls]


@router.post("/playlists")
async def create_playlist(body: PlaylistIn, user: dict = Depends(get_current_user)):
    doc = {
        "playlist_id": f"pl_{uuid.uuid4().hex[:12]}",
        "user_id": str(user["_id"]),
        "name": body.name.strip(),
        "description": body.description,
        "song_ids": [],
        "created_at": now_utc(),
    }
    await db.playlists.insert_one(dict(doc))
    return await _hydrate_playlist(dict(doc))


@router.get("/playlists/{playlist_id}")
async def get_playlist(playlist_id: str, user: dict = Depends(get_current_user)):
    pl = await db.playlists.find_one({"playlist_id": playlist_id, "user_id": str(user["_id"])})
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return await _hydrate_playlist(pl)


@router.delete("/playlists/{playlist_id}")
async def delete_playlist(playlist_id: str, user: dict = Depends(get_current_user)):
    res = await db.playlists.delete_one({"playlist_id": playlist_id, "user_id": str(user["_id"])})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return {"ok": True}


@router.post("/playlists/{playlist_id}/songs")
async def add_to_playlist(playlist_id: str, body: SongRef, user: dict = Depends(get_current_user)):
    pl = await db.playlists.find_one({"playlist_id": playlist_id, "user_id": str(user["_id"])})
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
    await db.playlists.update_one(
        {"playlist_id": playlist_id}, {"$addToSet": {"song_ids": body.song_id}}
    )
    pl = await db.playlists.find_one({"playlist_id": playlist_id})
    return await _hydrate_playlist(pl)


@router.delete("/playlists/{playlist_id}/songs/{song_id}")
async def remove_from_playlist(playlist_id: str, song_id: str, user: dict = Depends(get_current_user)):
    pl = await db.playlists.find_one({"playlist_id": playlist_id, "user_id": str(user["_id"])})
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
    await db.playlists.update_one({"playlist_id": playlist_id}, {"$pull": {"song_ids": song_id}})
    pl = await db.playlists.find_one({"playlist_id": playlist_id})
    return await _hydrate_playlist(pl)


# ---------------- Liked songs ----------------

@router.get("/library/liked")
async def liked_songs(user: dict = Depends(get_current_user)):
    ids = user.get("liked_songs", [])
    if not ids:
        return []
    docs = await db.songs.find({"song_id": {"$in": ids}}, {"_id": 0}).to_list(500)
    by_id = {s["song_id"]: s for s in docs}
    out = []
    for sid in ids:
        s = by_id.get(sid)
        if not s:
            continue
        alb = await db.albums.find_one({"album_id": s.get("album_id")}, {"_id": 0, "title": 1, "artist_name": 1, "thumbnail": 1})
        if alb:
            s["album_title"] = alb.get("title")
            s["artist_name"] = alb.get("artist_name")
            s["thumbnail"] = s.get("thumbnail") or alb.get("thumbnail")
        out.append(s)
    return out


@router.post("/library/like/{song_id}")
async def toggle_like(song_id: str, user: dict = Depends(get_current_user)):
    song = await db.songs.find_one({"song_id": song_id})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    liked = user.get("liked_songs", [])
    if song_id in liked:
        await db.users.update_one({"_id": user["_id"]}, {"$pull": {"liked_songs": song_id}})
        await db.songs.update_one({"song_id": song_id}, {"$inc": {"likes": -1}})
        return {"liked": False}
    else:
        await db.users.update_one({"_id": user["_id"]}, {"$addToSet": {"liked_songs": song_id}})
        await db.songs.update_one({"song_id": song_id}, {"$inc": {"likes": 1}})
        return {"liked": True}
