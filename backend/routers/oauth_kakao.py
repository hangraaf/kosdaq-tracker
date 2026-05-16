"""Kakao OAuth 2.0 로그인 — 별개 계정 정책 (이메일 자동 머지 안 함)."""
from __future__ import annotations

import secrets
import urllib.parse
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import settings
import db
from routers.auth import create_token

router = APIRouter(prefix="/auth/oauth/kakao", tags=["oauth-kakao"])

KAKAO_AUTHORIZE_URL = "https://kauth.kakao.com/oauth/authorize"
KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token"
KAKAO_USERINFO_URL = "https://kapi.kakao.com/v2/user/me"

_STATE_TTL_SECONDS = 600  # 10분


def _redirect_uri() -> str:
    return f"{settings.oauth_backend_base_url.rstrip('/')}/auth/oauth/kakao/callback"


def _make_state(return_to: str = "/") -> str:
    """CSRF 방지용 state 토큰 — JWT로 stateless 발행, 10분 TTL."""
    payload = {
        "purpose": "oauth_state",
        "provider": "kakao",
        "nonce": secrets.token_urlsafe(16),
        "return_to": return_to,
        "exp": datetime.now(timezone.utc) + timedelta(seconds=_STATE_TTL_SECONDS),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def _verify_state(state: str) -> dict:
    try:
        payload = jwt.decode(state, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        raise HTTPException(status_code=400, detail="OAuth state가 유효하지 않습니다.")
    if payload.get("purpose") != "oauth_state" or payload.get("provider") != "kakao":
        raise HTTPException(status_code=400, detail="OAuth state purpose 불일치.")
    return payload


@router.get("/login")
def kakao_login(return_to: str = Query("/", description="로그인 성공 후 돌아갈 프론트 경로")):
    if not settings.kakao_rest_api_key:
        return _redirect_to_frontend(
            error="카카오 로그인이 아직 활성화되지 않았습니다. 운영자에게 문의해 주세요."
        )
    state = _make_state(return_to=return_to)
    params = {
        "client_id": settings.kakao_rest_api_key,
        "redirect_uri": _redirect_uri(),
        "response_type": "code",
        "state": state,
        # 카카오 콘솔에서 활성화한 동의항목 자동 적용. 필요 시 scope 명시 가능.
    }
    return RedirectResponse(
        url=f"{KAKAO_AUTHORIZE_URL}?{urllib.parse.urlencode(params)}",
        status_code=302,
    )


@router.get("/callback")
def kakao_callback(
    code: str = Query(...),
    state: str = Query(...),
    error: str | None = Query(None),
    error_description: str | None = Query(None),
):
    if error:
        return _redirect_to_frontend(error=error_description or error)

    state_payload = _verify_state(state)
    return_to = state_payload.get("return_to") or "/"

    # 1) code → access_token
    try:
        with httpx.Client(timeout=10.0) as client:
            token_res = client.post(
                KAKAO_TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "client_id": settings.kakao_rest_api_key,
                    "redirect_uri": _redirect_uri(),
                    "code": code,
                    **({"client_secret": settings.kakao_client_secret} if settings.kakao_client_secret else {}),
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            token_res.raise_for_status()
            kakao_token = token_res.json().get("access_token")
            if not kakao_token:
                return _redirect_to_frontend(error="Kakao 토큰 응답이 비어 있습니다.")

            # 2) access_token → user info
            user_res = client.get(
                KAKAO_USERINFO_URL,
                headers={"Authorization": f"Bearer {kakao_token}"},
            )
            user_res.raise_for_status()
            kakao_user = user_res.json()
    except httpx.HTTPError as exc:
        return _redirect_to_frontend(error=f"Kakao API 호출 실패: {exc}")

    kakao_id = str(kakao_user.get("id") or "")
    if not kakao_id:
        return _redirect_to_frontend(error="Kakao 사용자 ID를 받지 못했습니다.")

    kakao_account = kakao_user.get("kakao_account", {}) or {}
    profile = kakao_account.get("profile", {}) or {}
    nickname = profile.get("nickname") or f"카카오{kakao_id[-4:]}"
    email = kakao_account.get("email") or ""
    email_verified = bool(kakao_account.get("is_email_verified")) and bool(email)

    # 3) 기존 카카오 계정 조회 또는 신규 생성
    existing = db.users_get_by_provider("kakao", kakao_id)
    if existing:
        uname = existing["username"]
        # 닉네임/이메일이 카카오에서 갱신됐을 수 있어 업데이트
        update_fields: dict = {}
        if nickname and nickname != existing.get("display"):
            update_fields["display"] = nickname
        if email and email != existing.get("email"):
            update_fields["email"] = email
            update_fields["email_verified"] = email_verified
        if update_fields:
            db.users_update(uname, **update_fields)
    else:
        # username은 충돌 방지를 위해 kakao_<id> 형식 고정
        uname = f"kakao_{kakao_id}"
        if db.users_get(uname):
            # 극히 드문 충돌 — suffix 붙여 회피
            uname = f"kakao_{kakao_id}_{secrets.token_hex(2)}"
        db.users_create(
            username=uname,
            pwd_hash="",   # 비밀번호 로그인 불가 (OAuth 전용)
            display=nickname,
            email=email,
            email_verified=email_verified,
            plan="free",
            provider="kakao",
            provider_user_id=kakao_id,
            marketing_opt_in=False,   # 별도 동의 절차 필요
        )

    # 4) JWT 발행 후 프론트로 리다이렉트 (URL fragment로 토큰 전달)
    user = db.users_get(uname)
    if not user:
        return _redirect_to_frontend(error="사용자 조회 실패")
    app_token = create_token({"sub": uname})
    return _redirect_to_frontend(
        token=app_token,
        username=uname,
        display=user.get("display") or uname,
        plan=user.get("plan") or "free",
        return_to=return_to,
    )


def _redirect_to_frontend(
    *,
    token: str = "",
    username: str = "",
    display: str = "",
    plan: str = "",
    return_to: str = "/",
    error: str = "",
) -> RedirectResponse:
    """프론트 콜백 페이지로 리다이렉트. 토큰은 URL fragment(#)로 전달해 서버 로그에 남지 않게 함."""
    base = settings.oauth_frontend_base_url.rstrip("/")
    if error:
        params = urllib.parse.urlencode({"error": error})
        return RedirectResponse(url=f"{base}/auth/callback?{params}", status_code=302)
    fragment = urllib.parse.urlencode({
        "token": token,
        "username": username,
        "display": display,
        "plan": plan,
        "return_to": return_to,
    })
    return RedirectResponse(url=f"{base}/auth/callback#{fragment}", status_code=302)
