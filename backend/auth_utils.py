"""JWT + bcrypt auth utilities and FastAPI dependencies for Vibe."""
import os
from datetime import timedelta
from typing import Optional

import bcrypt
import jwt
from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from db import db, now_utc

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
TOKEN_MINUTES = int(os.environ.get("ACCESS_TOKEN_MINUTES", "43200"))

# auto_error=False lets us support guest (unauthenticated) access on public routes.
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: str, role: str) -> str:
    now = now_utc()
    payload = {
        "sub": user_id,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=TOKEN_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def public_user(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "user_id": str(doc["_id"]),
        "email": doc["email"],
        "name": doc.get("name", ""),
        "role": doc.get("role", "customer"),
        "is_premium": doc.get("is_premium", False),
        "subscription": doc.get("subscription"),
        "created_at": str(doc.get("created_at")) if doc.get("created_at") else None,
        "picture": doc.get("picture"),
        "liked_songs": doc.get("liked_songs", []),
    }


async def _user_from_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id or not ObjectId.is_valid(user_id):
            return None
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user or user.get("disabled", False):
        return None
    return user


async def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not creds:
        raise unauthorized
    user = await _user_from_token(creds.credentials)
    if not user:
        raise unauthorized
    return user


async def get_optional_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[dict]:
    """Returns the user if a valid token is present, else None (guest)."""
    if not creds:
        return None
    return await _user_from_token(creds.credentials)


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ("admin", "moderator", "content_manager"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
