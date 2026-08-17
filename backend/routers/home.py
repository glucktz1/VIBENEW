"""Home feed aggregation + recommendation engine (diversity-aware).

Faithful port of Gracefy's next-song recommendation scoring:
  same_album=100, genre_match=40, popularity=25, artist_match=20, recency=15
plus a diversity fallback so the queue does not collapse to one artist.
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
import random

from db import db
from auth_utils import get_optional_user

router = APIRouter(prefix="/api", tags=["home"])

REC_WEIGHTS = {
    "same_album": 100,
    "genre_match": 40,
    "popularity": 25,
    "artist_match": 20,
    "recency": 15,
}


async def _album_map(album_ids):
    docs = await db.albums.find({"album_id": {"$in": list(album_ids)}}, {"_id": 0}).to_list(500)
    return {a["album_id"]: a for a in docs}


def _decorate(songs, amap):
    for s in songs:
        alb = amap.get(s.get("album_id"))
        if alb:
            s["album_title"] = alb.get("title")
            s["artist_name"] = alb.get("artist_name")
            s["thumbnail"] = s.get("thumbnail") or alb.get("thumbnail")
    return songs


@router.get("/home")
async def home_feed(user: Optional[dict] = Depends(get_optional_user)):
    # Trending: most-played active songs
    trending = await db.songs.find({"status": "active"}, {"_id": 0}).sort("plays", -1).limit(10).to_list(10)
    # New releases: latest albums
    new_albums = await db.albums.find({"status": "active"}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    for a in new_albums:
        a["songs_count"] = await db.songs.count_documents({"album_id": a["album_id"], "status": "active"})
    # Featured categories (genre rails)
    categories = await db.categories.find({}, {"_id": 0}).sort("name", 1).to_list(20)

    amap = await _album_map({s.get("album_id") for s in trending})
    _decorate(trending, amap)

    sections = [
        {"id": "trending", "title": "Trending Now", "type": "songs", "items": trending},
        {"id": "new", "title": "New Releases", "type": "albums", "items": new_albums},
    ]

    # Popular artists rail (approved artists with content)
    artists = await db.artists.find(
        {"status": "approved"}, {"_id": 0, "artist_id": 1, "name": 1, "photo_url": 1, "image_url": 1, "avatar_url": 1}
    ).limit(20).to_list(20)
    artist_items = []
    for ar in artists:
        cnt = await db.albums.count_documents({"artist_id": ar["artist_id"], "status": "active"})
        scnt = await db.songs.count_documents({"artist_id": ar["artist_id"], "status": "active"})
        if cnt == 0 and scnt == 0:
            continue
        artist_items.append({
            "artist_id": ar["artist_id"],
            "name": ar.get("name"),
            "thumbnail": ar.get("photo_url") or ar.get("image_url") or ar.get("avatar_url"),
            "albums_count": cnt,
            "songs_count": scnt,
        })
    if artist_items:
        sections.append({"id": "artists", "title": "Wasanii Maarufu", "type": "artists", "items": artist_items})

    # Per-category album rails
    for cat in categories[:6]:
        albums = await db.albums.find(
            {"status": "active", "category_id": cat["category_id"]}, {"_id": 0}
        ).sort("total_plays", -1).limit(10).to_list(10)
        if not albums:
            continue
        for a in albums:
            a["songs_count"] = await db.songs.count_documents({"album_id": a["album_id"], "status": "active"})
        sections.append({
            "id": f"cat_{cat['category_id']}",
            "title": cat["name"],
            "type": "albums",
            "items": albums,
        })

    # Recently played (logged-in)
    recently = []
    if user:
        events = await db.play_events.find(
            {"user_id": str(user["_id"])}, {"_id": 0}
        ).sort("created_at", -1).limit(30).to_list(30)
        seen = set()
        ids = []
        for e in events:
            sid = e.get("song_id")
            if sid and sid not in seen:
                seen.add(sid)
                ids.append(sid)
            if len(ids) >= 10:
                break
        if ids:
            docs = await db.songs.find({"song_id": {"$in": ids}}, {"_id": 0}).to_list(10)
            by = {d["song_id"]: d for d in docs}
            recently = [by[i] for i in ids if i in by]
            ramap = await _album_map({s.get("album_id") for s in recently})
            _decorate(recently, ramap)
    if recently:
        sections.insert(0, {"id": "recent", "title": "Jump Back In", "type": "songs", "items": recently})

    # --- Curated rows (admin-manageable via Layout Manager) ---
    made = await db.songs.find({"status": "active"}, {"_id": 0}).sort("plays", -1).limit(8).to_list(8)
    _decorate(made, await _album_map({s.get("album_id") for s in made}))
    if made:
        sections.append({"id": "recommended", "title": "Made for You", "type": "recommended", "items": made})

    pow_albums = await db.albums.find({"status": "active"}, {"_id": 0}).sort("total_plays", -1).limit(5).to_list(5)
    for a in pow_albums:
        a["songs_count"] = await db.songs.count_documents({"album_id": a["album_id"], "status": "active"})
    if pow_albums:
        sections.append({"id": "pick_week", "title": "Pick of the Week", "type": "pick_week", "items": pow_albums})

    recent_albums = await db.albums.find({"status": "active"}, {"_id": 0}).sort("created_at", -1).limit(8).to_list(8)
    for a in recent_albums:
        a["songs_count"] = await db.songs.count_documents({"album_id": a["album_id"], "status": "active"})
    if recent_albums:
        sections.append({"id": "recently_added", "title": "Recently Added", "type": "albums", "items": recent_albums})

    # Apply admin Layout Manager config (order + enable/disable)
    cfg = await db.app_config.find_one({"key": "home_layout"}, {"_id": 0})
    layout = (cfg or {}).get("value") or []
    if layout:
        order_map = {row["id"]: i for i, row in enumerate(layout)}
        disabled = {row["id"] for row in layout if not row.get("enabled", True)}
        sections = [s for s in sections if s["id"] not in disabled]
        sections.sort(key=lambda s: order_map.get(s["id"], 999))

    return {"sections": sections, "greeting_name": user.get("name") if user else None}


@router.get("/recommendations/next")
async def next_recommendations(
    song_id: str = Query(...),
    limit: int = Query(15, le=50),
):
    """Return an ordered queue of next songs using weighted scoring + diversity fallback."""
    seed = await db.songs.find_one({"song_id": song_id}, {"_id": 0})
    candidates = await db.songs.find(
        {"status": "active", "song_id": {"$ne": song_id}}, {"_id": 0}
    ).to_list(1000)

    if not seed:
        random.shuffle(candidates)
        chosen = candidates[:limit]
        amap = await _album_map({s.get("album_id") for s in chosen})
        return {"songs": _decorate(chosen, amap)}

    seed_album = seed.get("album_id")
    seed_cats = set(seed.get("song_categories", []) or [])
    seed_alb = await db.albums.find_one({"album_id": seed_album}, {"_id": 0, "artist_id": 1, "category_id": 1})
    seed_artist = seed_alb.get("artist_id") if seed_alb else None
    seed_category = seed_alb.get("category_id") if seed_alb else None

    max_plays = max([c.get("plays", 0) for c in candidates], default=1) or 1
    alb_ids = {c.get("album_id") for c in candidates}
    amap = await _album_map(alb_ids)

    scored = []
    for c in candidates:
        score = 0
        alb = amap.get(c.get("album_id"))
        if c.get("album_id") == seed_album:
            score += REC_WEIGHTS["same_album"]
        c_cats = set(c.get("song_categories", []) or [])
        if seed_cats and (seed_cats & c_cats):
            score += REC_WEIGHTS["genre_match"]
        if alb and seed_artist and alb.get("artist_id") == seed_artist:
            score += REC_WEIGHTS["artist_match"]
        if alb and seed_category and alb.get("category_id") == seed_category:
            score += 10
        # popularity contribution (normalized)
        score += REC_WEIGHTS["popularity"] * (c.get("plays", 0) / max_plays)
        c["_score"] = score
        scored.append(c)

    scored.sort(key=lambda x: x.get("_score", 0), reverse=True)

    # Diversity fallback: cap consecutive songs from the same artist/album.
    result = []
    last_artist = None
    same_artist_streak = 0
    pool = list(scored)
    while pool and len(result) < limit:
        picked = None
        for i, c in enumerate(pool):
            alb = amap.get(c.get("album_id"))
            artist = alb.get("artist_id") if alb else None
            if artist == last_artist and same_artist_streak >= 2:
                continue
            picked = pool.pop(i)
            if artist == last_artist:
                same_artist_streak += 1
            else:
                same_artist_streak = 0
                last_artist = artist
            break
        if picked is None:
            picked = pool.pop(0)
            same_artist_streak = 0
        result.append(picked)

    for s in result:
        s.pop("_score", None)
    return {"songs": _decorate(result, amap)}
