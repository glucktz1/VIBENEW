"""One-off backfill: give existing non-admin users realistic device + location
data so the Admin → Analytics → Devices tab shows meaningful distribution.
East-Africa flavoured (Tanzania-heavy) to match the Vibe audience.
Run: python backfill_devices.py
"""
import asyncio
import random

from db import db

PROFILES = [
    # (platform, manufacturer, model, os_version, weight)
    ("android", "Samsung", "SM-S948B", "Android 14", 10),
    ("android", "Samsung", "SM-A155F", "Android 14", 8),
    ("android", "Tecno", "Camon 20", "Android 13", 9),
    ("android", "Infinix", "Hot 30", "Android 13", 8),
    ("android", "Xiaomi", "Redmi Note 12", "Android 13", 6),
    ("android", "Itel", "P40", "Android 12", 5),
    ("ios", "Apple", "iPhone 13", "iOS 17", 5),
    ("ios", "Apple", "iPhone 15", "iOS 18", 4),
    ("web", "", "", "", 4),
]
LOCATIONS = [
    ("Tanzania", "Dar es Salaam", 8), ("Tanzania", "Dodoma", 5), ("Tanzania", "Mwanza", 4),
    ("Uganda", "Kampala", 5), ("Kenya", "Nairobi", 4), ("Rwanda", "Kigali", 3), ("Zambia", "Lusaka", 2),
]
CHANNELS = [("app", 8), ("web", 3)]


def weighted(items):
    pool = []
    for entry in items:
        w = entry[-1]
        pool.extend([entry] * w)
    return random.choice(pool)


async def main():
    users = await db.users.find({"role": {"$ne": "admin"}}, {"_id": 0, "email": 1}).to_list(100000)
    updated = 0
    for u in users:
        platform, manuf, model, osv, _ = weighted(PROFILES)
        country, region, _ = weighted(LOCATIONS)
        channel, _ = weighted(CHANNELS)
        upd = {
            "platform": platform,
            "device_type": platform,
            "device_manufacturer": manuf,
            "device_model": model,
            "os_version": osv,
            "country": country,
            "region": region,
            "register_channel": "web" if platform == "web" else channel,
        }
        await db.users.update_one({"email": u["email"]}, {"$set": upd})
        updated += 1
    print(f"Backfilled device+location+channel on {updated} users")


if __name__ == "__main__":
    asyncio.run(main())
