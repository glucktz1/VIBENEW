from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from db import db, clean, clean_list, now_utc
from auth_utils import get_optional_user

router = APIRouter(prefix="/api", tags=["music"])


async def _attach_songs_count(albums: list) -> list:
    for a in albums:
        if "songs_count" not in a or a.get("songs_count") is None:
            a["songs_count"] = await db.songs.count_documents(
                {"album_id": a["album_id"], "status": "active"}
            )
    return albums


@router.get("/categories")
async def list_categories():
    cats = await db.categories.find({"status": {"$ne": "inactive"}}, {"_id": 0}).sort("sort_order", 1).to_list(200)
    return cats


_DEFAULT_PILL_NAMES = ["Bongo Hits", "Gospel", "R&B", "Amapiano", "Taarabu"]


@router.get("/home-genres")
async def home_genres():
    """Ordered genre filter pills for the app Home (admin-configurable via Layout Manager)."""
    cats = await db.categories.find({"status": {"$ne": "inactive"}}, {"_id": 0}).sort("sort_order", 1).to_list(200)
    by_id = {c["category_id"]: c for c in cats}
    cfg = await db.app_config.find_one({"key": "home_genres"}, {"_id": 0})
    ids = (cfg or {}).get("value")
    if ids:
        return [by_id[i] for i in ids if i in by_id]
    # No admin config yet => show ALL categories as pills.
    return cats


@router.get("/song-categories")
async def list_song_categories():
    cats = await db.song_categories.find({"status": "active"}, {"_id": 0}).sort("sort_order", 1).to_list(200)
    return cats


@router.get("/albums")
async def list_albums(
    category_id: Optional[str] = None,
    tag: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = Query(50, le=200),
):
    query: dict = {"status": "active"}
    if category_id:
        query["category_id"] = category_id
    if tag:
        query["tags"] = {"$in": [tag]}
    if q:
        query["title"] = {"$regex": q, "$options": "i"}
    albums = await db.albums.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return await _attach_songs_count(albums)


@router.get("/albums/{album_id}")
async def get_album(album_id: str):
    album = await db.albums.find_one({"album_id": album_id}, {"_id": 0})
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    songs = await db.songs.find(
        {"album_id": album_id, "status": "active"}, {"_id": 0}
    ).sort("track_number", 1).to_list(500)
    album["songs"] = songs
    album["songs_count"] = len(songs)
    return album


@router.get("/songs")
async def list_songs(
    q: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = Query(50, le=200),
):
    query: dict = {"status": "active"}
    if q:
        query["title"] = {"$regex": q, "$options": "i"}
    if category:
        query["song_categories"] = {"$in": [category]}
    songs = await db.songs.find(query, {"_id": 0}).sort("plays", -1).to_list(limit)
    # attach album info for convenience
    for s in songs:
        alb = await db.albums.find_one({"album_id": s.get("album_id")}, {"_id": 0, "title": 1, "artist_name": 1, "thumbnail": 1})
        if alb:
            s["album_title"] = alb.get("title")
            s["artist_name"] = alb.get("artist_name")
            s["thumbnail"] = s.get("thumbnail") or alb.get("thumbnail")
    return songs


@router.get("/songs/{song_id}")
async def get_song(song_id: str):
    song = await db.songs.find_one({"song_id": song_id}, {"_id": 0})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    alb = await db.albums.find_one({"album_id": song.get("album_id")}, {"_id": 0})
    if alb:
        song["album_title"] = alb.get("title")
        song["artist_name"] = alb.get("artist_name")
        song["thumbnail"] = song.get("thumbnail") or alb.get("thumbnail")
    return song


@router.post("/songs/{song_id}/play")
async def track_play(song_id: str, user: Optional[dict] = Depends(get_optional_user)):
    song = await db.songs.find_one({"song_id": song_id})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    await db.songs.update_one({"song_id": song_id}, {"$inc": {"plays": 1}})
    await db.albums.update_one({"album_id": song.get("album_id")}, {"$inc": {"total_plays": 1}})
    # log play event for analytics
    await db.play_events.insert_one({
        "song_id": song_id,
        "album_id": song.get("album_id"),
        "user_id": str(user["_id"]) if user else None,
        "is_guest": user is None,
        "created_at": now_utc(),
    })
    return {"ok": True, "plays": song.get("plays", 0) + 1}


@router.get("/search")
async def search(q: str = Query(..., min_length=1)):
    regex = {"$regex": q, "$options": "i"}
    albums = await db.albums.find(
        {"status": "active", "$or": [{"title": regex}, {"artist_name": regex}]}, {"_id": 0}
    ).limit(20).to_list(20)
    albums = await _attach_songs_count(albums)
    songs = await db.songs.find({"status": "active", "title": regex}, {"_id": 0}).limit(20).to_list(20)
    for s in songs:
        alb = await db.albums.find_one({"album_id": s.get("album_id")}, {"_id": 0, "title": 1, "artist_name": 1, "thumbnail": 1})
        if alb:
            s["album_title"] = alb.get("title")
            s["artist_name"] = alb.get("artist_name")
            s["thumbnail"] = s.get("thumbnail") or alb.get("thumbnail")
    return {"albums": albums, "songs": songs, "query": q}
