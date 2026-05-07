"""KOSDAQ Tracker — FastAPI 백엔드."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import auth, payments, portfolio, robo, stocks

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


@app.on_event("startup")
async def startup_event():
    """환경변수로 admin 계정 자동 생성/업그레이드."""
    import os, json, hashlib
    from config import DATA_DIR
    username = os.getenv("ADMIN_USERNAME", "").strip().lower()
    password = os.getenv("ADMIN_PASSWORD", "").strip()
    if not username or not password:
        return
    users_file = DATA_DIR / "users.json"
    users = {}
    if users_file.exists():
        try:
            users = json.loads(users_file.read_text(encoding="utf-8"))
        except Exception:
            pass
    pwd_hash = hashlib.sha256(password.encode()).hexdigest()
    users[username] = {
        "pwd_hash": pwd_hash,
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
