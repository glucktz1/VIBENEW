"""Vibe backend — Christian music streaming platform (Gracefy clone)."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from db import client, db
from seed import seed
from routers import (
    auth, music, playlists, home, radio, bible, neno, churches, billing, admin,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("vibe")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await seed()
    except Exception as e:  # never block startup on seed failure
        logger.exception("Seed failed: %s", e)
    yield
    client.close()


app = FastAPI(title="Vibe API", lifespan=lifespan)


@app.get("/api/")
async def root():
    return {"app": "Vibe", "status": "ok"}


@app.get("/api/health")
async def health():
    return {"status": "healthy"}


for r in (auth, music, playlists, home, radio, bible, neno, churches, billing, admin):
    app.include_router(r.router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
