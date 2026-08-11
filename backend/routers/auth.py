from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from pymongo.errors import DuplicateKeyError

from db import db, now_utc
from auth_utils import (
    hash_password,
    verify_password,
    create_access_token,
    public_user,
    get_current_user,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = ""


@router.post("/register")
async def register(body: RegisterIn):
    doc = {
        "email": str(body.email).lower(),
        "name": body.name.strip(),
        "password_hash": hash_password(body.password),
        "role": "customer",
        "is_premium": False,
        "subscription": None,
        "liked_songs": [],
        "disabled": False,
        "created_at": now_utc(),
    }
    try:
        res = await db.users.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Email already registered")
    doc["_id"] = res.inserted_id
    token = create_access_token(str(res.inserted_id), "customer")
    return {"access_token": token, "token_type": "bearer", "user": public_user(doc)}


@router.post("/login")
async def login(body: LoginIn):
    email = str(body.email).lower()
    user = await db.users.find_one({"email": email})
    if not user or user.get("disabled"):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    # Admin can log in with an empty password (faithful to Gracefy admin behavior).
    is_admin = user.get("role") in ("admin", "moderator", "content_manager")
    if not (is_admin and body.password == ""):
        if not verify_password(body.password, user.get("password_hash", "")):
            raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = create_access_token(str(user["_id"]), user.get("role", "customer"))
    return {"access_token": token, "token_type": "bearer", "user": public_user(user)}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)
