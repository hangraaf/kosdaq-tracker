"""KOSDAQ Tracker — FastAPI 백엔드."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import auth, guru, payments, portfolio, robo, stocks

app = FastAPI(
    title="KOSDAQ Tracker API",
    description="Mr. Stock Buddy — PRISM™ 기반 한국 주식 트래커",
    version="2.0.0",
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
app.include_router(portfolio.router)
app.include_router(robo.router)
app.include_router(payments.router)
app.include_router(guru.router)


@app.on_event("startup")
async def startup_event():
    """환경변수로 admin plan 자동 부여 — 기존 비밀번호 유지."""
    import os, json, hashlib
    from config import DATA_DIR
    username = os.getenv("ADMIN_USERNAME", "").strip().lower()
    if not username:
        return
    users_file = DATA_DIR / "users.json"
    users = {}
    if users_file.exists():
        try:
            users = json.loads(users_file.read_text(encoding="utf-8"))
        except Exception:
            pass
    if username in users:
        # 기존 계정 plan만 admin으로 승격 (비밀번호 유지)
        users[username]["plan"] = "admin"
    else:
        # 계정이 없으면 새로 생성
        password = os.getenv("ADMIN_PASSWORD", "").strip()
        if not password:
            return
        users[username] = {
            "pwd_hash": hashlib.sha256(password.encode()).hexdigest(),
            "display": os.getenv("ADMIN_DISPLAY", username),
            "email": os.getenv("ADMIN_EMAIL", ""),
            "plan": "admin",
        }
    users_file.write_text(json.dumps(users, ensure_ascii=False, indent=2), encoding="utf-8")


@app.get("/")
def root():
    return {"message": "Mr. Stock Buddy API v2.0 — PRISM™ Engine Active"}


@app.get("/health")
def health():
    return {"status": "ok"}
