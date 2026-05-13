"""KOSDAQ Tracker — FastAPI 백엔드."""
from __future__ import annotations

import json
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

# Windows cp949 터미널에서 한글/유니코드 출력 오류 방지
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if sys.stderr.encoding and sys.stderr.encoding.lower() not in ("utf-8", "utf8"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import DATA_DIR, settings
from routers import auth, guru, market, news, payments, portfolio, robo, stocks


def _init_admin():
    """환경변수로 admin plan 자동 부여 — 기존 비밀번호 유지."""
    username = os.getenv("ADMIN_USERNAME", "").strip().lower()
    if not username:
        return
    users_file = DATA_DIR / "users.json"
    users: dict = {}
    if users_file.exists():
        try:
            users = json.loads(users_file.read_text(encoding="utf-8"))
        except Exception:
            pass
    if username in users:
        users[username]["plan"] = "admin"
        print(f"[STARTUP] {username} → admin 승격 완료")
    else:
        password = os.getenv("ADMIN_PASSWORD", "").strip()
        if not password:
            return
        from routers.auth import _hash_pw
        users[username] = {
            "pwd_hash": _hash_pw(password),
            "display": os.getenv("ADMIN_DISPLAY", username),
            "email": os.getenv("ADMIN_EMAIL", ""),
            "plan": "admin",
        }
        print(f"[STARTUP] {username} 신규 admin 계정 생성 완료")
    users_file.write_text(json.dumps(users, ensure_ascii=False, indent=2), encoding="utf-8")


@asynccontextmanager
async def lifespan(app: FastAPI):
    import db as _db
    _db.init_db()
    print("[STARTUP] SQLite 캐시 DB 초기화 완료")
    _init_admin()
    yield


app = FastAPI(
    title="KOSDAQ Tracker API",
    description="Mr. Stock Buddy — PRISM™ 기반 한국 주식 트래커",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.all_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(stocks.router)
app.include_router(market.router)
app.include_router(portfolio.router)
app.include_router(robo.router)
app.include_router(payments.router)
app.include_router(guru.router)
app.include_router(news.router)


@app.get("/debug/kis")
def debug_kis():
    """KIS 설정 상태 확인용."""
    from pathlib import Path
    from config import settings, BASE_DIR
    from kis_service import kis_available, get_kis_client
    env_path = BASE_DIR / ".env"
    client = get_kis_client()
    return {
        "env_file": str(env_path),
        "env_exists": env_path.exists(),
        "kis_app_key_prefix": settings.kis_app_key[:8] if settings.kis_app_key else "(없음)",
        "kis_env": settings.kis_env,
        "kis_available": kis_available(),
        "client_type": type(client).__name__ if client else None,
    }


@app.get("/debug/admin")
def debug_admin():
    """admin 계정 존재 여부 확인용 (비밀번호 제외)."""
    import os, json
    from config import DATA_DIR
    users_file = DATA_DIR / "users.json"
    if not users_file.exists():
        return {"users_file": "없음", "users": []}
    users = json.loads(users_file.read_text(encoding="utf-8"))
    return {
        "users_file": "존재",
        "users": [{"username": k, "plan": v.get("plan"), "display": v.get("display")} for k, v in users.items()],
    }


@app.get("/")
def root():
    return {"message": "Mr. Stock Buddy API v2.0 — PRISM™ Engine Active"}


@app.get("/health")
def health():
    return {"status": "ok"}
