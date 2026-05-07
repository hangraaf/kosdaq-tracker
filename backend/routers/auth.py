"""인증 라우터 — 회원가입, 로그인, 프로필."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import DATA_DIR, settings
from models import TokenResponse, UserCreate, UserProfile

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

USERS_FILE = DATA_DIR / "users.json"


def _load_users() -> dict:
    if USERS_FILE.exists():
        try:
            return json.loads(USERS_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _save_users(users: dict) -> None:
    USERS_FILE.write_text(json.dumps(users, ensure_ascii=False, indent=2), encoding="utf-8")


def _hash_pw(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _create_token(data: dict) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload["exp"] = expire
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> dict:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        username: str = payload.get("sub", "")
        if not username:
            raise HTTPException(status_code=401, detail="토큰이 유효하지 않습니다.")
    except JWTError:
        raise HTTPException(status_code=401, detail="토큰이 유효하지 않습니다.")
    users = _load_users()
    user = users.get(username)
    if not user:
        raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다.")
    return {"username": username, "display": user.get("display", username),
            "plan": user.get("plan", "free"), "email": user.get("email", "")}


def get_premium_user(current: Annotated[dict, Depends(get_current_user)]) -> dict:
    if current.get("plan") not in ("premium", "admin"):
        raise HTTPException(status_code=403, detail="프리미엄 구독이 필요한 기능입니다.")
    return current


@router.post("/register", response_model=TokenResponse)
def register(body: UserCreate):
    users = _load_users()
    uname = body.username.strip().lower()
    if uname in users:
        raise HTTPException(status_code=400, detail="이미 사용 중인 아이디입니다.")
    users[uname] = {
        "pwd_hash": _hash_pw(body.password),
        "display": body.display or body.username,
        "email": body.email,
        "plan": "free",
    }
    _save_users(users)
    token = _create_token({"sub": uname})
    return TokenResponse(access_token=token, username=uname,
                         display=users[uname]["display"], plan="free")


@router.post("/token", response_model=TokenResponse)
def login(form: Annotated[OAuth2PasswordRequestForm, Depends()]):
    users = _load_users()
    uname = form.username.strip().lower()
    user = users.get(uname)
    if not user or user.get("pwd_hash") != _hash_pw(form.password):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")
    token = _create_token({"sub": uname})
    return TokenResponse(access_token=token, username=uname,
                         display=user.get("display", uname), plan=user.get("plan", "free"))


@router.get("/me", response_model=UserProfile)
def me(current: Annotated[dict, Depends(get_current_user)]):
    return UserProfile(**current)
