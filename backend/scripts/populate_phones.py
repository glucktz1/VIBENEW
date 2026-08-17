"""One-time: give existing customer accounts a TZ phone number if missing.
Makes the SMS marketing-campaign preview usable with real demo data.
"""
import asyncio
import random
import sys
sys.path.insert(0, "/app/backend")

from db import db


async def main():
    users = await db.users.find({"role": {"$in": ["customer", "user"]}}).to_list(5000)
    updated = 0
    for i, u in enumerate(users):
        if u.get("phone"):
            continue
        # ~85% of users get a phone; rest stay without (to exercise "no phone" state)
        if random.random() < 0.15:
            continue
        num = f"+2557{random.randint(10000000, 99999999)}"
        await db.users.update_one({"_id": u["_id"]}, {"$set": {"phone": num}})
        updated += 1
    print(f"users={len(users)} phones_added={updated}")


if __name__ == "__main__":
    asyncio.run(main())
