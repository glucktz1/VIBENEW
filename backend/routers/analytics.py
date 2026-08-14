"""Admin dashboard analytics — faithful port of Gracefy's dashboard endpoints.

Response shapes mirror what the Gracefy admin Dashboard consumes so the ported
React Native dashboard renders 1:1 with the original web dashboard.
"""
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends

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
