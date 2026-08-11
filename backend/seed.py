"""Seed Vibe with demo content: royalty-free audio + placeholder artwork.

Audio: SoundHelix royalty-free demo tracks.
Images: Unsplash (from design guidelines) + Picsum placeholders.
All titles/text are original placeholders — no copyrighted material.
"""
import asyncio
import os
import uuid

import bcrypt
from db import db, now_utc

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@vibe.app")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Vibe@2026")

AUDIO = [f"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-{i}.mp3" for i in range(1, 17)]

ART = [
    "https://images.unsplash.com/photo-1581084349663-7ab88c58d362?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
    "https://images.unsplash.com/photo-1682778964790-b2fa177b5e45?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
    "https://images.unsplash.com/photo-1593462475357-67ac85ec71a7?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
    "https://images.unsplash.com/photo-1762425476678-12878efac31d?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
    "https://images.unsplash.com/photo-1755442038693-2f3b6fd79b9b?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
    "https://images.unsplash.com/photo-1762275588185-5eaec5a6dc4a?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
    "https://images.unsplash.com/photo-1761901219315-bfe7d72340b9?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
    "https://images.unsplash.com/photo-1760367120038-34885d779db1?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
]
PORTRAITS = [
    "https://images.unsplash.com/photo-1673757519094-6063fec0549c?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
    "https://images.unsplash.com/photo-1760893107446-58b108d419d8?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
    "https://images.unsplash.com/photo-1589668944320-409833e5ba10?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
]
CHURCH_IMG = [
    "https://images.unsplash.com/photo-1762425476678-12878efac31d?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    "https://images.unsplash.com/photo-1755442038693-2f3b6fd79b9b?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    "https://images.unsplash.com/photo-1762275588185-5eaec5a6dc4a?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
]

CATEGORIES = [
    ("cat_worship", "Ibada", "Worship", 1),
    ("cat_praise", "Sifa", "Praise", 2),
    ("cat_gospel", "Injili", "Gospel", 3),
    ("cat_choir", "Kwaya", "Choir", 4),
    ("cat_instrumental", "Ala", "Instrumental", 5),
    ("cat_kids", "Watoto", "Kids", 6),
]

SONG_CATEGORIES = [
    ("songcat_mpya", "Mpya", "New", "#00A8E8", 1),
    ("songcat_krismasi", "Krismasi", "Christmas", "#2ED573", 2),
    ("songcat_pasaka", "Pasaka", "Easter", "#FFA502", 3),
    ("songcat_kwaresma", "Kwaresma", "Lent", "#a78bfa", 4),
    ("songcat_jumapili", "Jumapili", "Sunday", "#48CAE4", 5),
]

ARTISTS = [
    "Zawadi Voices", "Neema Choir", "Baraka Singers", "Upendo Band",
    "Tumaini Collective", "Amani Worship", "Furaha Gospel", "Wema Ensemble",
]

ALBUM_TITLES = [
    ("Nuru ya Milele", "cat_worship", ["Mpya", "Jumapili"]),
    ("Sauti za Mbinguni", "cat_praise", ["Mpya"]),
    ("Wimbo wa Neema", "cat_gospel", ["Jumapili"]),
    ("Furaha ya Roho", "cat_choir", ["Krismasi"]),
    ("Utukufu", "cat_worship", ["Pasaka"]),
    ("Baraka za Asubuhi", "cat_praise", ["Mpya"]),
    ("Kwaya Takatifu", "cat_choir", ["Jumapili"]),
    ("Amani ya Moyo", "cat_instrumental", ["Kwaresma"]),
]

SONG_NAMES = [
    "Asante Bwana", "Wewe ni Mwaminifu", "Nakuabudu", "Tumaini Langu",
    "Njoo Roho Mtakatifu", "Sifa kwa Mfalme", "Neema Isiyostahili",
    "Kaa Nami", "Mwamba Wangu", "Furaha Tele", "Baraka Tele", "Uwepo Wako",
]


async def seed():
    # ---- admin ----
    if not await db.users.find_one({"email": ADMIN_EMAIL.lower()}):
        await db.users.insert_one({
            "email": ADMIN_EMAIL.lower(),
            "name": "Vibe Admin",
            "password_hash": bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt()).decode(),
            "role": "admin",
            "is_premium": True,
            "subscription": None,
            "liked_songs": [],
            "disabled": False,
            "created_at": now_utc(),
        })
    try:
        await db.users.create_index("email", unique=True, name="uniq_user_email")
    except Exception:
        pass

    if await db.albums.count_documents({}) > 0:
        print("Content already seeded; skipping content seed.")
        return

    # ---- categories ----
    cat_name = {}
    for cid, name_sw, name_en, order in CATEGORIES:
        cat_name[cid] = name_sw
        await db.categories.insert_one({
            "category_id": cid, "name": name_sw, "name_en": name_en,
            "type": "music", "status": "active", "sort_order": order,
            "created_at": now_utc(),
        })
    for sid, name, name_en, color, order in SONG_CATEGORIES:
        await db.song_categories.insert_one({
            "song_category_id": sid, "name": name, "name_en": name_en,
            "color": color, "sort_order": order, "status": "active",
            "created_at": now_utc(),
        })

    # ---- albums + songs ----
    audio_i = 0
    for idx, (title, cat_id, tags) in enumerate(ALBUM_TITLES):
        artist = ARTISTS[idx % len(ARTISTS)]
        album_id = f"alb_{uuid.uuid4().hex[:12]}"
        artist_id = f"art_{idx}"
        thumb = ART[idx % len(ART)]
        n_songs = 4 + (idx % 2)
        await db.albums.insert_one({
            "album_id": album_id,
            "title": title,
            "artist_id": artist_id,
            "artist_name": artist,
            "description": f"{title} — {artist}",
            "category_id": cat_id,
            "category_name": cat_name[cat_id],
            "thumbnail": thumb,
            "tags": tags,
            "monetization_type": "free" if idx % 3 else "premium",
            "status": "active",
            "songs_count": n_songs,
            "total_plays": (idx + 1) * 137,
            "created_at": now_utc(),
        })
        for t in range(n_songs):
            sname = SONG_NAMES[(idx * 3 + t) % len(SONG_NAMES)]
            dur = 180 + ((idx + t) % 6) * 20
            await db.songs.insert_one({
                "song_id": f"song_{uuid.uuid4().hex[:12]}",
                "title": sname,
                "album_id": album_id,
                "audio_url": AUDIO[audio_i % len(AUDIO)],
                "duration": dur,
                "duration_formatted": f"{dur // 60}:{dur % 60:02d}",
                "track_number": t + 1,
                "song_categories": [SONG_CATEGORIES[(idx + t) % len(SONG_CATEGORIES)][0]],
                "plays": ((idx * 5 + t) * 43) % 900,
                "likes": ((idx + t) * 7) % 200,
                "status": "active",
                "thumbnail": thumb,
                "created_at": now_utc(),
            })
            audio_i += 1

    # ---- radio ----
    radios = [
        ("Vibe Worship FM", "24/7 worship & praise", ART[0], "https://ice1.somafm.com/groovesalad-128-mp3"),
        ("Gospel Beats", "Contemporary gospel", ART[1], "https://ice1.somafm.com/gsclassic-128-mp3"),
        ("Kwaya Live", "Choir & hymns", ART[6], "https://ice1.somafm.com/dronezone-128-mp3"),
        ("Amani Radio", "Peaceful instrumental", ART[7], "https://ice1.somafm.com/deepspaceone-128-mp3"),
    ]
    for i, (name, desc, img, stream) in enumerate(radios):
        await db.radio_stations.insert_one({
            "station_id": f"radio_{i+1}",
            "name": name, "description": desc, "thumbnail": img,
            "stream_url": stream, "listeners": (i + 1) * 52,
            "status": "active", "sort_order": i, "created_at": now_utc(),
        })

    # ---- bible ----
    books = [
        ("gen", "Mwanzo", "Genesis", 1, 50, "old"),
        ("exo", "Kutoka", "Exodus", 2, 40, "old"),
        ("psa", "Zaburi", "Psalms", 19, 150, "old"),
        ("mat", "Mathayo", "Matthew", 40, 28, "new"),
        ("jhn", "Yohana", "John", 43, 21, "new"),
        ("rom", "Warumi", "Romans", 45, 16, "new"),
        ("rev", "Ufunuo", "Revelation", 66, 22, "new"),
    ]
    for bid, name, name_en, order, chapters, testament in books:
        await db.bible_books.insert_one({
            "book_id": bid, "name": name, "name_en": name_en,
            "order": order, "chapters": chapters, "testament": testament,
            "created_at": now_utc(),
        })
    # Genesis 1 (KJV, public domain) — sample chapter with audio
    await db.bible_verses.insert_one({
        "book_id": "gen", "chapter": 1,
        "audio_url": AUDIO[0],
        "verses": [
            {"verse": 1, "text": "In the beginning God created the heaven and the earth."},
            {"verse": 2, "text": "And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters."},
            {"verse": 3, "text": "And God said, Let there be light: and there was light."},
            {"verse": 4, "text": "And God saw the light, that it was good: and God divided the light from the darkness."},
            {"verse": 5, "text": "And God called the light Day, and the darkness he called Night. And the evening and the morning were the first day."},
        ],
    })

    # ---- leaders + neno la leo ----
    leaders = [
        ("leader_1", "Fr. Emmanuel Haule", "Parish Priest", PORTRAITS[0]),
        ("leader_2", "Rev. Grace Mushi", "Worship Leader", PORTRAITS[1]),
        ("leader_3", "Pastor Daniel Kimaro", "Senior Pastor", PORTRAITS[2]),
    ]
    for lid, name, title, photo in leaders:
        await db.leaders.insert_one({
            "leader_id": lid, "name": name, "title": title, "photo": photo,
            "status": "active", "created_at": now_utc(),
        })
    neno_items = [
        ("Tumaini Katika Bwana", "Zaburi 23:1", "leader_1",
         "Bwana ndiye mchungaji wangu; sitapungukiwa na kitu. Tafakari juu ya wema wake leo."),
        ("Neema ya Kila Siku", "Maombolezo 3:22-23", "leader_2",
         "Huruma za Bwana ni mpya kila asubuhi. Pumzika katika uaminifu wake."),
        ("Nuru ya Ulimwengu", "Yohana 8:12", "leader_3",
         "Yesu ni nuru ya ulimwengu; anayemfuata hatatembea gizani."),
        ("Amani Isiyo na Kifani", "Wafilipi 4:7", "leader_1",
         "Amani ya Mungu ipitayo akili zote itailinda mioyo yenu."),
    ]
    for i, (title, verse, lid, body) in enumerate(neno_items):
        await db.neno_entries.insert_one({
            "entry_id": f"neno_{i+1}",
            "title": title, "verse_reference": verse, "leader_id": lid,
            "reading_text": body,
            "reflection_text": f"Tafakari: {body}",
            "reading_audio_url": AUDIO[(i + 2) % len(AUDIO)],
            "reflection_audio_url": AUDIO[(i + 5) % len(AUDIO)] if i % 2 == 0 else None,
            "thumbnail": ART[i % len(ART)],
            "status": "published",
            "publish_date": now_utc().isoformat(),
            "reading_plays": (i + 1) * 12,
            "reflection_plays": (i + 1) * 5,
            "total_plays": (i + 1) * 17,
            "created_at": now_utc(),
        })

    # ---- churches ----
    churches = [
        ("St. Joseph Cathedral", "Dar es Salaam", CHURCH_IMG[0]),
        ("Grace Community Church", "Arusha", CHURCH_IMG[1]),
        ("Living Word Chapel", "Mwanza", CHURCH_IMG[2]),
    ]
    for i, (name, loc, img) in enumerate(churches):
        cid = f"church_{i+1}"
        await db.churches.insert_one({
            "church_id": cid, "name": name, "location": loc,
            "description": f"{name}, {loc}",
            "thumbnail": img, "cover_image": img,
            "schedule": {"Sunday": "07:00, 10:00, 17:00", "Wednesday": "18:00"},
            "followers_count": (i + 1) * 340, "members_count": (i + 1) * 1200,
            "status": "approved", "created_at": now_utc(),
        })
        await db.church_announcements.insert_one({
            "announcement_id": f"ann_{cid}",
            "church_id": cid, "title": "Ratiba ya Ibada",
            "body": "Karibu kwenye ibada zetu wikendi hii. Ushirika wa vijana Jumamosi saa 10 jioni.",
            "created_at": now_utc(),
        })

    # ---- subscription plans ----
    plans = [
        ("plan_daily", "Kwa Siku", 500, 1, "Ufikiaji kamili kwa siku 1"),
        ("plan_weekly", "Kwa Wiki", 2000, 7, "Ufikiaji kamili kwa siku 7"),
        ("plan_monthly", "Kwa Mwezi", 5500, 30, "Ufikiaji kamili kwa siku 30"),
    ]
    for pid, name, price, days, desc in plans:
        await db.subscription_plans.insert_one({
            "plan_id": pid, "name": name, "price": price,
            "duration_days": days, "currency": "TZS",
            "description": desc, "status": "active", "created_at": now_utc(),
        })

    await db.app_config.update_one({"key": "billing"}, {"$set": {"value": True}}, upsert=True)
    print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
