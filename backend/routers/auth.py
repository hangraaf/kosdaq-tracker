"""인증 라우터 — 회원가입, 로그인, 프로필."""
from __future__ import annotations

import hashlib
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import settings
import db
from models import TokenResponse, UserCreate, UserProfile, UserProfileUpdate, PasswordChange

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
_EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")


def _hash_pw(password: str) -> str:
    return _pwd_ctx.hash(password)


def _verify_pw(plain: str, hashed: str) -> bool:
    """bcrypt 검증. 레거시 SHA-256(64자리 hex)도 허용."""
    if not hashed:
        return False
    if _SHA256_RE.match(hashed):
        return hashlib.sha256(plain.encode("utf-8")).hexdigest() == hashed
    return _pwd_ctx.verify(plain, hashed)


def _upgrade_hash_if_needed(uname: str, stored: str, plain: str) -> None:
    """로그인 성공 시 레거시 SHA-256 해시를 bcrypt로 자동 업그레이드."""
    if _SHA256_RE.match(stored or ""):
        db.users_update(uname, pwd_hash=_hash_pw(plain))


def create_token(data: dict) -> str:
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
    user = db.users_get(username)
    if not user:
        raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다.")
    return {
        "username": username,
        "display": user.get("display") or username,
        "plan": user.get("plan") or "free",
        "email": user.get("email") or "",
        "marketing_opt_in": bool(user.get("marketing_opt_in")),
        "created_at": float(user.get("created_at") or 0),
        "provider": user.get("provider") or "",
    }


def get_premium_user(current: Annotated[dict, Depends(get_current_user)]) -> dict:
    if current.get("plan") not in ("premium", "admin"):
        raise HTTPException(status_code=403, detail="프리미엄 구독이 필요한 기능입니다.")
    return current


@router.post("/register", response_model=TokenResponse)
def register(body: UserCreate):
    uname = body.username.strip().lower()
    if not _EMAIL_RE.match(uname):
        raise HTTPException(status_code=400, detail="올바른 이메일 형식이 아닙니다.")
    display = (body.display or "").strip()
    if not display:
        raise HTTPException(status_code=400, detail="닉네임을 입력해 주세요.")
    if db.users_get(uname):
        raise HTTPException(status_code=400, detail="이미 가입된 이메일입니다.")
    # email 필드는 username과 동일하게 저장 (이메일=ID 정책)
    email = (body.email or uname).strip().lower()
    db.users_create(
        username=uname,
        pwd_hash=_hash_pw(body.password),
        display=display,
        email=email,
        plan="free",
        marketing_opt_in=body.marketing_opt_in,
    )
    token = create_token({"sub": uname})
    return TokenResponse(
        access_token=token, username=uname,
        display=display, plan="free",
    )


@router.post("/token", response_model=TokenResponse)
def login(form: Annotated[OAuth2PasswordRequestForm, Depends()]):
    uname = form.username.strip().lower()
    user = db.users_get(uname)
    if not user or not _verify_pw(form.password, user.get("pwd_hash") or ""):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")
    _upgrade_hash_if_needed(uname, user.get("pwd_hash") or "", form.password)
    token = create_token({"sub": uname})
    return TokenResponse(
        access_token=token, username=uname,
        display=user.get("display") or uname, plan=user.get("plan") or "free",
    )


@router.get("/me", response_model=UserProfile)
def me(current: Annotated[dict, Depends(get_current_user)]):
    return UserProfile(**current)


@router.patch("/me", response_model=UserProfile)
def update_me(
    body: UserProfileUpdate,
    current: Annotated[dict, Depends(get_current_user)],
):
    """프로필 갱신 — 닉네임, 마케팅 동의 토글. 입력하지 않은 필드는 보존."""
    fields: dict = {}
    if body.display is not None:
        d = body.display.strip()
        if not d:
            raise HTTPException(status_code=400, detail="닉네임을 입력해 주세요.")
        if len(d) > 40:
            raise HTTPException(status_code=400, detail="닉네임은 40자 이내로 입력해 주세요.")
        fields["display"] = d
    if body.marketing_opt_in is not None:
        fields["marketing_opt_in"] = body.marketing_opt_in
        fields["marketing_opt_in_at"] = time.time() if body.marketing_opt_in else 0
    if fields:
        db.users_update(current["username"], **fields)
    user = db.users_get(current["username"]) or {}
    return UserProfile(
        username=current["username"],
        display=user.get("display") or current["username"],
        plan=user.get("plan") or "free",
        email=user.get("email") or "",
        marketing_opt_in=bool(user.get("marketing_opt_in")),
        created_at=float(user.get("created_at") or 0),
        provider=user.get("provider") or "",
    )


@router.post("/password")
def change_password(
    body: PasswordChange,
    current: Annotated[dict, Depends(get_current_user)],
):
    """로그인 상태에서 비밀번호 변경. OAuth-only 계정(pwd_hash 빈 값)은 거부."""
    user = db.users_get(current["username"])
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    stored = user.get("pwd_hash") or ""
    if not stored:
        raise HTTPException(
            status_code=400,
            detail="소셜 로그인 계정은 비밀번호가 설정되어 있지 않습니다.",
        )
    if not _verify_pw(body.current_password, stored):
        raise HTTPException(status_code=401, detail="현재 비밀번호가 올바르지 않습니다.")
    if body.current_password == body.new_password:
        raise HTTPException(status_code=400, detail="새 비밀번호는 기존과 달라야 합니다.")
    db.users_update(current["username"], pwd_hash=_hash_pw(body.new_password))
    return {"ok": True}


@router.post("/marketing-opt-in")
def set_marketing_opt_in(
    opt_in: bool,
    current: Annotated[dict, Depends(get_current_user)],
):
    """프로필에서 마케팅 수신 동의 토글."""
    db.users_set_marketing_opt_in(current["username"], opt_in)
    return {"ok": True, "marketing_opt_in": opt_in}


@router.get("/upgrade")
def upgrade_plan(
    username: str,
    plan: str,
    admin_secret: str,
):
    """관리자 플랜 변경 — ADMIN_SECRET 키로 보호."""
    expected = os.getenv("ADMIN_SECRET", settings.secret_key)
    if admin_secret != expected:
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    if plan not in ("free", "premium", "admin"):
        raise HTTPException(status_code=400, detail="유효하지 않은 플랜입니다.")
    uname = username.strip().lower()
    if not db.users_get(uname):
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    db.users_update(uname, plan=plan)
    return {"ok": True, "username": uname, "plan": plan}
