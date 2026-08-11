"""MongoDB connection and helpers for Vibe."""
import os
from pathlib import Path
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso_now() -> str:
    return now_utc().isoformat()


def clean(doc: dict) -> dict:
    """Strip Mongo _id so documents are JSON serializable."""
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


def clean_list(docs: list) -> list:
    return [clean(d) for d in docs]
