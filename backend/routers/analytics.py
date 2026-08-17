"""Admin dashboard analytics — faithful port of Gracefy's dashboard endpoints.

Response shapes mirror what the Gracefy admin Dashboard consumes so the ported
React Native dashboard renders 1:1 with the original web dashboard.
"""
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query

from db import db
from auth_utils import require_admin

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _month_bounds(now: datetime, i: int):
    """Return (start, end, label) for the month `i` months before `now`."""
    month_start = (now - timedelta(days=30 * i)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    # first day of the following month
    end = (month_start + timedelta(days=32)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return month_start, end, month_start.strftime("%b")


@router.get("/overview")
async def overview(admin: dict = Depends(require_admin)):
    total_users = await db.users.count_documents({})
    total_customers = await db.users.count_documents({"role": "customer"})
    total_system_users = await db.users.count_documents({"role": {"$ne": "customer"}})
    total_songs = await db.songs.count_documents({})
    total_albums = await db.albums.count_documents({})
    total_churches = await db.churches.count_documents({})
    total_leaders = await db.churches.count_documents({"leader_name": {"$exists": True, "$ne": None}})
    total_donations = await db.transactions.count_documents({"status": "completed"})
    pending_approvals = await db.churches.count_documents({"status": "pending"})

    txns = await db.transactions.find({"status": "completed"}, {"_id": 0, "amount": 1}).to_list(10000)
    total_raised = sum(t.get("amount", 0) for t in txns)

    return {
        "total_users": total_users,
        "total_customers": total_customers,
        "total_system_users": total_system_users,
        "total_songs": total_songs,
        "total_albums": total_albums,
        "total_churches": total_churches,
        "total_leaders": total_leaders,
        "total_donations": total_donations,
        "pending_approvals": pending_approvals,
        "total_raised": total_raised,
        "currency": "TZS",
    }


@router.get("/trends")
async def trends(admin: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc)

    # User growth — cumulative users + active (played) users per month, last 6 months
    user_growth = []
    for i in range(5, -1, -1):
        _start, end, label = _month_bounds(now, i)
        total = await db.users.count_documents({"created_at": {"$lt": end}})
        active_ids = await db.play_events.distinct(
            "user_id", {"created_at": {"$gte": _start, "$lt": end}, "user_id": {"$ne": None}}
        )
        user_growth.append({"month": label, "users": total, "active": len(active_ids)})

    # Content performance — plays grouped by album category
    cat_pipeline = [
        {"$group": {"_id": "$category_name", "plays": {"$sum": {"$ifNull": ["$total_plays", 0]}}}},
        {"$sort": {"plays": -1}},
        {"$limit": 6},
    ]
    cats = await db.albums.aggregate(cat_pipeline).to_list(6)
    content_performance = [
        {"category": c["_id"] or "Uncategorized", "plays": c["plays"]} for c in cats if c["plays"] > 0
    ]
    if not content_performance:
        songs = await db.songs.count_documents({})
        albums = await db.albums.count_documents({})
        content_performance = [
            {"category": "Songs", "plays": songs},
            {"category": "Albums", "plays": albums},
        ]

    # Donations (revenue) trend — completed transaction amounts per month
    donations_trend = []
    for i in range(5, -1, -1):
        _start, end, label = _month_bounds(now, i)
        rows = await db.transactions.find(
            {"status": "completed", "created_at": {"$gte": _start, "$lt": end}},
            {"_id": 0, "amount": 1},
        ).to_list(10000)
        donations_trend.append({"month": label, "amount": sum(r.get("amount", 0) for r in rows)})

    return {
        "user_growth": user_growth,
        "content_performance": content_performance,
        "donations_trend": donations_trend,
    }


@router.get("/user-demographics")
async def user_demographics(admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0}).to_list(10000)

    device_stats: dict = {}
    gender_stats: dict = {}
    age_stats = {"0-17": 0, "18-24": 0, "25-34": 0, "35-44": 0, "45-54": 0, "55+": 0}
    location_stats: dict = {}
    current_year = datetime.now().year

    for u in users:
        dev = (u.get("device_type") or "Unknown").upper()
        device_stats[dev] = device_stats.get(dev, 0) + 1

        g = (u.get("gender") or "Unknown").capitalize()
        gender_stats[g] = gender_stats.get(g, 0) + 1

        by = u.get("birth_year")
        if by:
            age = current_year - by
            if age < 18:
                age_stats["0-17"] += 1
            elif age < 25:
                age_stats["18-24"] += 1
            elif age < 35:
                age_stats["25-34"] += 1
            elif age < 45:
                age_stats["35-44"] += 1
            elif age < 55:
                age_stats["45-54"] += 1
            else:
                age_stats["55+"] += 1

        loc = u.get("country") or u.get("location") or "Tanzania"
        if isinstance(loc, dict):
            loc = loc.get("country") or loc.get("name") or "Tanzania"
        location_stats[str(loc)] = location_stats.get(str(loc), 0) + 1

    top_locations = sorted(location_stats.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        "total_users": len(users),
        "device": {"data": [{"name": k, "value": v} for k, v in device_stats.items()]},
        "gender": {"data": [{"name": k, "value": v} for k, v in gender_stats.items()]},
        "age": {"data": [{"name": k, "value": v} for k, v in age_stats.items() if v > 0]},
        "location": {
            "data": [{"name": k, "value": v} for k, v in top_locations],
            "total_locations": len(location_stats),
        },
    }


@router.get("/realtime")
async def realtime(admin: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    five_min_ago = now - timedelta(minutes=5)

    active_streams = await db.play_events.count_documents({"created_at": {"$gte": five_min_ago}})
    active_ids = await db.play_events.distinct(
        "user_id", {"created_at": {"$gte": five_min_ago}, "user_id": {"$ne": None}}
    )
    plays_today = await db.play_events.count_documents({"created_at": {"$gte": today_start}})
    guest_today = await db.play_events.count_documents({"created_at": {"$gte": today_start}, "is_guest": True})
    new_users_today = await db.users.count_documents({"created_at": {"$gte": today_start}})
    txns_today = await db.transactions.count_documents({"created_at": {"$gte": today_start}, "status": "completed"})

    return {
        "timestamp": now.isoformat(),
        "active_streams": active_streams,
        "active_listeners": len(active_ids),
        "plays_today": plays_today,
        "guest_visitors_today": guest_today,
        "new_users_today": new_users_today,
        "transactions_today": txns_today,
    }


@router.get("/download-stats")
async def download_stats(admin: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)

    total = await db.downloads.count_documents({})
    if total == 0:
        return None  # dashboard hides the banner when there is nothing to show

    today = await db.downloads.count_documents({"created_at": {"$gte": today_start}})
    week = await db.downloads.count_documents({"created_at": {"$gte": week_ago}})
    uniq = await db.downloads.distinct("user_id", {"user_id": {"$ne": None}})

    top_pipeline = [
        {"$group": {"_id": "$song_id", "title": {"$first": "$title"}, "downloads": {"$sum": 1}}},
        {"$sort": {"downloads": -1}},
        {"$limit": 5},
    ]
    top = await db.downloads.aggregate(top_pipeline).to_list(5)

    return {
        "total_downloads": total,
        "downloads_today": today,
        "downloads_this_week": week,
        "unique_downloaders": len(uniq),
        "top_downloaded_songs": [
            {"title": t.get("title") or "Untitled", "downloads": t["downloads"]} for t in top
        ],
    }


@router.get("/live-listeners")
async def live_listeners(admin: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=2)

    active = await db.play_events.find(
        {"created_at": {"$gte": cutoff}}, {"_id": 0, "song_id": 1, "user_id": 1}
    ).to_list(1000)

    by_song: dict = {}
    users = set()
    for a in active:
        if a.get("user_id"):
            users.add(a["user_id"])
        sid = a.get("song_id")
        if sid:
            by_song[sid] = by_song.get(sid, 0) + 1

    # attach titles
    top = sorted(by_song.items(), key=lambda x: x[1], reverse=True)[:5]
    top_playing_now = []
    for sid, count in top:
        song = await db.songs.find_one({"song_id": sid}, {"_id": 0, "title": 1})
        top_playing_now.append({"title": song.get("title") if song else "Unknown", "listeners": count})

    return {
        "total_active_listeners": len(active),
        "unique_users": len(users),
        "top_playing_now": top_playing_now,
        "timestamp": now.isoformat(),
    }


PLATFORM_CUT = 0.30  # platform keeps 30%, artist gets 70%
PER_PLAY = 50  # simulated TZS earned per play


async def _avg_song_minutes() -> float:
    songs = await db.songs.find({}, {"_id": 0, "duration": 1}).to_list(5000)
    durs = [s.get("duration") for s in songs if s.get("duration")]
    if not durs:
        return 3.5
    return round((sum(durs) / len(durs)) / 60.0, 1)


@router.get("/enhanced")
async def enhanced(period: str = "30d", admin: dict = Depends(require_admin)):
    # parse period like "7d", "30d", "90d", "365d" into a time window
    try:
        days = int(str(period).rstrip("d"))
    except (ValueError, AttributeError):
        days = 30
    start = datetime.now(timezone.utc) - timedelta(days=days)
    time_filter = {"created_at": {"$gte": start}}

    total_streams = await db.play_events.count_documents(time_filter)
    revenue_streams = await db.play_events.count_documents({**time_filter, "is_guest": False})
    listener_ids = await db.play_events.distinct("user_id", {**time_filter, "user_id": {"$ne": None}})
    song_ids = await db.play_events.distinct("song_id", {**time_filter, "song_id": {"$ne": None}})
    avg_min = await _avg_song_minutes()
    total_hours = round(total_streams * avg_min / 60.0, 1)

    txns = await db.transactions.find({"status": "completed", "created_at": {"$gte": start}}, {"_id": 0, "amount": 1}).to_list(10000)
    gross = sum(t.get("amount", 0) for t in txns)

    top = await db.songs.find({}, {"_id": 0, "title": 1, "plays": 1, "artist_name": 1}).sort("plays", -1).limit(8).to_list(8)
    cat = await db.albums.aggregate([
        {"$group": {"_id": "$category_name", "value": {"$sum": {"$ifNull": ["$total_plays", 0]}}}},
        {"$sort": {"value": -1}}, {"$limit": 6},
    ]).to_list(6)

    return {
        "period": period,
        "overview": {
            "total_streams": total_streams,
            "revenue_streams": revenue_streams,
            "unique_listeners": len(listener_ids),
            "total_listening_hours": total_hours,
            "avg_session_duration": avg_min,
            "gross_revenue": gross,
            "platform_revenue": round(gross * PLATFORM_CUT),
            "unique_songs_played": len(song_ids),
        },
        "top_songs": [{"title": t.get("title"), "artist": t.get("artist_name"), "plays": t.get("plays", 0)} for t in top],
        "category_breakdown": [{"name": c["_id"] or "Uncategorized", "value": c["value"]} for c in cat if c["value"] > 0],
    }


@router.get("/revenue-overview")
async def revenue_overview(admin: dict = Depends(require_admin)):
    txns = await db.transactions.find({"status": "completed"}, {"_id": 0, "amount": 1}).to_list(10000)
    gross = sum(t.get("amount", 0) for t in txns)
    total_streams = await db.play_events.count_documents({})
    avg_min = await _avg_song_minutes()
    total_hours = round(total_streams * avg_min / 60.0, 1)

    # daily revenue, last 14 days
    now = datetime.now(timezone.utc)
    daily = []
    for i in range(13, -1, -1):
        day = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        nxt = day + timedelta(days=1)
        rows = await db.transactions.find(
            {"status": "completed", "created_at": {"$gte": day, "$lt": nxt}}, {"_id": 0, "amount": 1}
        ).to_list(5000)
        daily.append({"date": day.strftime("%d/%m"), "amount": sum(r.get("amount", 0) for r in rows)})

    # per-artist earnings (simulated from plays of their songs)
    artists = await db.artists.find({}, {"_id": 0, "artist_id": 1, "name": 1}).to_list(500)
    all_artists = []
    for a in artists:
        ids = await db.songs.distinct("song_id", {"artist_id": a["artist_id"]})
        plays = await db.play_events.count_documents({"song_id": {"$in": ids}}) if ids else 0
        earned = plays * PER_PLAY
        all_artists.append({
            "name": a["name"], "plays": plays,
            "gross": earned, "net": round(earned * (1 - PLATFORM_CUT)),
        })
    all_artists.sort(key=lambda x: x["gross"], reverse=True)

    top_albums = await db.albums.find({}, {"_id": 0, "title": 1, "total_plays": 1, "artist_name": 1}).sort("total_plays", -1).limit(5).to_list(5)

    return {
        "currency": "TZS",
        "total_listening_hours": total_hours,
        "gross_revenue": gross,
        "platform_earnings": round(gross * PLATFORM_CUT),
        "artist_payouts": round(gross * (1 - PLATFORM_CUT)),
        "daily": daily,
        "top_artists": all_artists[:5],
        "top_albums": [{"title": t.get("title"), "artist": t.get("artist_name"), "plays": t.get("total_plays", 0)} for t in top_albums],
        "all_artists": all_artists,
    }


@router.get("/transactions")
async def admin_transactions(
    status: str = Query("all"),
    gateway: str = Query("all"),
    q: str = Query(""),
    admin: dict = Depends(require_admin),
):
    query: dict = {}
    if status != "all":
        query["status"] = status
    if q:
        query["$or"] = [
            {"phone": {"$regex": q, "$options": "i"}},
            {"plan_id": {"$regex": q, "$options": "i"}},
            {"user_id": {"$regex": q, "$options": "i"}},
        ]
    rows = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    for r in rows:
        r["gateway"] = r.get("gateway", "azampay_simulated")
        if r.get("created_at"):
            r["created_at"] = str(r["created_at"])

    all_rows = await db.transactions.find({}, {"_id": 0, "amount": 1, "status": 1}).to_list(20000)
    completed_rev = sum(r.get("amount", 0) for r in all_rows if r.get("status") == "completed")
    return {
        "summary": {
            "total": len(all_rows),
            "completed_revenue": completed_rev,
            "pending": sum(1 for r in all_rows if r.get("status") == "pending"),
            "failed": sum(1 for r in all_rows if r.get("status") in ("failed", "cancelled")),
            "currency": "TZS",
        },
        "gateways": ["azampay_simulated"],
        "transactions": rows,
    }


@router.get("/location-overview")
async def location_overview(admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "country": 1, "location": 1, "created_at": 1}).to_list(10000)
    countries: dict = {}
    for u in users:
        loc = u.get("country") or u.get("location") or "Tanzania"
        if isinstance(loc, dict):
            loc = loc.get("country") or loc.get("name") or "Tanzania"
        countries[str(loc)] = countries.get(str(loc), 0) + 1
    country_list = sorted(countries.items(), key=lambda x: x[1], reverse=True)

    # growth per month (last 6) cumulative
    now = datetime.now(timezone.utc)
    growth = []
    cumulative = 0
    for i in range(5, -1, -1):
        start, end, label = _month_bounds(now, i)
        new = await db.users.count_documents({"created_at": {"$gte": start, "$lt": end}})
        cumulative = await db.users.count_documents({"created_at": {"$lt": end}})
        growth.append({"month": label, "new": new, "cumulative": cumulative})

    return {
        "total_users": len(users),
        "total_countries": len(countries),
        "countries": [{"name": k, "value": v} for k, v in country_list],
        "growth": growth,
    }


AVG_STREAM_MB = 4.0  # simulated egress per stream
AVG_DOWNLOAD_MB = 6.0


@router.get("/data-usage")
async def data_usage(days: int = 30, admin: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    total_streams = await db.play_events.count_documents({"created_at": {"$gte": start}})
    total_downloads = await db.downloads.count_documents({"created_at": {"$gte": start}})
    avg_min = await _avg_song_minutes()
    listener_ids = await db.play_events.distinct("user_id", {"created_at": {"$gte": start}, "user_id": {"$ne": None}})

    streaming_gb = round(total_streams * AVG_STREAM_MB / 1024, 2)
    downloads_gb = round(total_downloads * AVG_DOWNLOAD_MB / 1024, 2)
    listening_minutes = round(total_streams * avg_min)

    per_day = []
    minutes_per_day = []
    for i in range(days - 1, -1, -1):
        day = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        nxt = day + timedelta(days=1)
        s = await db.play_events.count_documents({"created_at": {"$gte": day, "$lt": nxt}})
        d = await db.downloads.count_documents({"created_at": {"$gte": day, "$lt": nxt}})
        label = day.strftime("%m-%d")
        per_day.append({
            "date": label,
            "streams_mb": round(s * AVG_STREAM_MB, 1),
            "downloads_mb": round(d * AVG_DOWNLOAD_MB, 1),
        })
        minutes_per_day.append({"date": label, "minutes": round(s * avg_min)})

    return {
        "days": days,
        "total_data_gb": round(streaming_gb + downloads_gb, 2),
        "streaming_gb": streaming_gb,
        "downloads_gb": downloads_gb,
        "total_streams": total_streams,
        "total_downloads": total_downloads,
        "listening_minutes": listening_minutes,
        "unique_listeners": len(listener_ids),
        "per_day": per_day,
        "minutes_per_day": minutes_per_day,
    }


@router.get("/breakdown")
async def breakdown(admin: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc)
    total_users = await db.users.count_documents({})
    premium = await db.users.count_documents({"is_premium": True})
    free = total_users - premium

    # user growth last 6 months
    growth = []
    for i in range(5, -1, -1):
        start, end, label = _month_bounds(now, i)
        new = await db.users.count_documents({"created_at": {"$gte": start, "$lt": end}})
        growth.append({"month": label, "new": new})

    # content — top albums + songs count by album
    top_albums = await db.albums.find({}, {"_id": 0, "title": 1, "total_plays": 1}).sort("total_plays", -1).limit(6).to_list(6)
    total_songs = await db.songs.count_documents({})
    total_albums = await db.albums.count_documents({})

    # devices — from users device_type (best-effort)
    users = await db.users.find({}, {"_id": 0, "device_type": 1}).to_list(10000)
    dev: dict = {}
    for u in users:
        d = (u.get("device_type") or "Unknown").upper()
        dev[d] = dev.get(d, 0) + 1

    # replays — top replayed songs (by plays)
    top_replays = await db.songs.find({}, {"_id": 0, "title": 1, "plays": 1}).sort("plays", -1).limit(6).to_list(6)

    return {
        "users": {
            "total": total_users, "premium": premium, "free": free,
            "premium_pct": round((premium / total_users) * 100) if total_users else 0,
            "growth": growth,
        },
        "content": {
            "total_songs": total_songs, "total_albums": total_albums,
            "top_albums": [{"title": a.get("title"), "plays": a.get("total_plays", 0)} for a in top_albums],
        },
        "devices": {"data": [{"name": k, "value": v} for k, v in dev.items()]},
        "replays": {"top": [{"title": s.get("title"), "plays": s.get("plays", 0)} for s in top_replays]},
    }


@router.get("/device-distribution")
async def device_distribution(admin: dict = Depends(require_admin)):
    """Detailed device & platform distribution — faithful port of Gracefy's endpoint."""
    users = await db.users.find(
        {},
        {"_id": 0, "device_info": 1, "device_type": 1, "platform": 1,
         "device_model": 1, "device_manufacturer": 1, "os_version": 1,
         "location": 1, "country": 1, "city": 1},
    ).to_list(50000)

    platform_stats = {"android": 0, "ios": 0, "web": 0, "unknown": 0}
    manufacturer_stats: dict = {}
    model_stats: dict = {}
    location_stats: dict = {}
    os_version_stats: dict = {}

    for user in users:
        platform = (user.get("platform") or user.get("device_type") or "unknown").lower()
        if "android" in platform:
            platform_stats["android"] += 1
        elif "ios" in platform or "iphone" in platform or "ipad" in platform:
            platform_stats["ios"] += 1
        elif "web" in platform:
            platform_stats["web"] += 1
        else:
            platform_stats["unknown"] += 1

        device_info = user.get("device_info", {}) or {}
        manufacturer = (
            user.get("device_manufacturer")
            or device_info.get("manufacturer")
            or device_info.get("brand")
            or "Unknown"
        ).strip().title()
        low = manufacturer.lower()
        for key in ("samsung", "apple", "huawei", "xiaomi", "oppo", "vivo", "tecno", "infinix", "itel"):
            if key in low:
                manufacturer = "Apple" if key == "apple" else key.title()
                break
        manufacturer_stats[manufacturer] = manufacturer_stats.get(manufacturer, 0) + 1

        model = (
            user.get("device_model")
            or device_info.get("model")
            or device_info.get("modelName")
            or "Unknown"
        ).strip()
        if model and model != "Unknown":
            model_key = f"{manufacturer} {model}"
            model_stats[model_key] = model_stats.get(model_key, 0) + 1

        os_ver = (
            user.get("os_version")
            or device_info.get("osVersion")
            or device_info.get("systemVersion")
            or "Unknown"
        )
        os_version_stats[os_ver] = os_version_stats.get(os_ver, 0) + 1

        location = user.get("location") or user.get("country") or user.get("city") or "Unknown"
        if isinstance(location, dict):
            location = location.get("country") or location.get("name") or location.get("city") or "Unknown"
        if not isinstance(location, str):
            location = str(location) if location else "Unknown"
        location_stats[location] = location_stats.get(location, 0) + 1

    top_manufacturers = sorted(manufacturer_stats.items(), key=lambda x: x[1], reverse=True)[:15]
    top_models = sorted(model_stats.items(), key=lambda x: x[1], reverse=True)[:20]
    top_locations = sorted(location_stats.items(), key=lambda x: x[1], reverse=True)[:15]
    top_os_versions = sorted(os_version_stats.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        "total_users": len(users),
        "platform_distribution": platform_stats,
        "manufacturer_distribution": dict(top_manufacturers),
        "top_device_models": dict(top_models),
        "location_distribution": dict(top_locations),
        "os_version_distribution": dict(top_os_versions),
    }


@router.get("/content-performance")
async def content_performance(admin: dict = Depends(require_admin)):
    """Album performance table + top songs (faithful to Gracefy's Content analytics tab)."""
    avg_min = await _avg_song_minutes()
    albums = await db.albums.find({}, {"_id": 0, "album_id": 1, "title": 1, "artist_name": 1, "total_plays": 1, "monetization_type": 1}).to_list(2000)
    rows = []
    for a in albums:
        plays = a.get("total_plays")
        if plays is None:
            plays = await db.play_events.count_documents({"album_id": a.get("album_id")})
        minutes = round(plays * avg_min)
        rows.append({
            "album_id": a.get("album_id"),
            "title": a.get("title"),
            "artist_name": a.get("artist_name") or "Unknown",
            "monetization_type": a.get("monetization_type") or "standard",
            "total_plays": plays,
            "minutes_streamed": minutes,
            "total_hours": round(minutes / 60.0, 1),
            "avg_minutes_per_play": avg_min,
            "revenue": plays * PER_PLAY,
        })
    rows.sort(key=lambda x: x["total_plays"], reverse=True)

    songs = await db.songs.find({}, {"_id": 0, "song_id": 1, "title": 1, "artist_name": 1, "album_name": 1, "plays": 1}).sort("plays", -1).limit(15).to_list(15)
    top_songs = [{
        "song_id": s.get("song_id"),
        "title": s.get("title"),
        "artist": s.get("artist_name") or "Unknown",
        "album": s.get("album_name") or "",
        "plays": s.get("plays", 0),
        "hours": round(s.get("plays", 0) * avg_min / 60.0, 1),
    } for s in songs]

    return {"albums": rows[:20], "top_songs": top_songs}


@router.get("/replays")
async def replays(period: str = "week", admin: dict = Depends(require_admin)):
    """Replay analytics with day/week/month selector (faithful to Gracefy)."""
    now = datetime.now(timezone.utc)
    days = {"day": 1, "week": 7, "month": 30}.get(period, 7)
    start = now - timedelta(days=days)
    avg_min = await _avg_song_minutes()

    events = await db.play_events.find(
        {"created_at": {"$gte": start}, "user_id": {"$ne": None}, "song_id": {"$ne": None}},
        {"_id": 0, "user_id": 1, "song_id": 1},
    ).to_list(100000)

    pair_counts: dict = {}
    song_counts: dict = {}
    song_users: dict = {}
    for e in events:
        pk = (e["user_id"], e["song_id"])
        pair_counts[pk] = pair_counts.get(pk, 0) + 1
        song_counts[e["song_id"]] = song_counts.get(e["song_id"], 0) + 1
        song_users.setdefault(e["song_id"], set()).add(e["user_id"])

    replay_pairs = {k: v for k, v in pair_counts.items() if v > 1}
    users_who_replayed = len({u for (u, _s) in replay_pairs.keys()})
    total_replay_sessions = sum(v - 1 for v in replay_pairs.values())
    total_replay_minutes = round(total_replay_sessions * avg_min)

    async def _song(sid):
        return await db.songs.find_one({"song_id": sid}, {"_id": 0, "title": 1, "artist_name": 1})

    # user replays (top 20 by replay_count)
    user_replays = []
    for (uid, sid), cnt in sorted(replay_pairs.items(), key=lambda x: x[1], reverse=True)[:20]:
        s = await _song(sid)
        u = await _find_user_email(uid)
        user_replays.append({
            "song_title": (s or {}).get("title") or "Unknown",
            "user_name": u,
            "replay_count": cnt,
            "total_minutes": round(cnt * avg_min),
        })

    # top replayed songs
    top_songs = []
    for sid, plays in sorted(song_counts.items(), key=lambda x: x[1], reverse=True)[:15]:
        if plays <= 1:
            continue
        s = await _song(sid)
        uniq = len(song_users.get(sid, set())) or 1
        top_songs.append({
            "song_title": (s or {}).get("title") or "Unknown",
            "artist_name": (s or {}).get("artist_name") or "Unknown",
            "total_plays": plays,
            "unique_users": uniq,
            "replay_ratio": round(plays / uniq, 1),
        })

    return {
        "period": period,
        "summary": {
            "users_who_replayed": users_who_replayed,
            "total_replay_minutes": total_replay_minutes,
            "total_replay_sessions": total_replay_sessions,
        },
        "user_replays": user_replays,
        "top_replayed_songs": top_songs,
    }


async def _find_user_email(uid: str) -> str:
    try:
        from bson import ObjectId
        u = await db.users.find_one({"_id": ObjectId(uid)}, {"_id": 0, "name": 1, "email": 1})
    except Exception:
        u = None
    if not u:
        return "Anonymous"
    return u.get("name") or u.get("email") or "Anonymous"

@router.get("/free-minutes")
async def free_minutes(admin: dict = Depends(require_admin)):
    """Free listening minutes consumed via admin grants — NOT part of revenue."""
    users = await db.users.find(
        {"free_hours_used_seconds": {"$gt": 0}},
        {"_id": 0, "free_hours_used_seconds": 1},
    ).to_list(100000)
    total_seconds = sum(u.get("free_hours_used_seconds", 0) for u in users)
    now = datetime.now(timezone.utc)
    active_grants = await db.users.count_documents({
        "subscription.type": "free_hours",
        "free_listening_expires": {"$gt": now},
    })
    granted = await db.users.count_documents({"subscription.type": "free_hours"})
    return {
        "total_free_minutes": round(total_seconds / 60.0, 1),
        "total_free_hours": round(total_seconds / 3600.0, 1),
        "users_consumed": len(users),
        "active_grants": active_grants,
        "total_grants": granted,
        "note": "Free minutes are promotional and excluded from revenue.",
    }
