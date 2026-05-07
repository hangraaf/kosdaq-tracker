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
    print(f"[STARTUP] ADMIN_USERNAME={repr(username)}")
    if not username:
        print("[STARTUP] ADMIN_USERNAME 미설정 — 건너뜀")
        return
    users_file = DATA_DIR / "users.json"
    users = {}
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
            print("[STARTUP] ADMIN_PASSWORD 미설정 — 건너뜀")
            return
        users[username] = {
            "pwd_hash": hashlib.sha256(password.encode()).hexdigest(),
            "display": os.getenv("ADMIN_DISPLAY", username),
            "email": os.getenv("ADMIN_EMAIL", ""),
            "plan": "admin",
        }
        print(f"[STARTUP] {username} 신규 admin 계정 생성 완료")
    users_file.write_text(json.dumps(users, ensure_ascii=False, indent=2), encoding="utf-8")


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
