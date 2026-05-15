"""KOSDAQ Tracker — FastAPI 백엔드."""
from __future__ import annotations

import asyncio
import json
import os
import sys
from contextlib import asynccontextmanager
from datetime import datetime
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


_REFRESH_SCRIPT = Path(__file__).parent / "scripts" / "refresh_stocks.py"
_CACHE_FILE = DATA_DIR / "stocks_cache.json"
_CACHE_MAX_AGE_SECONDS = 86400  # 24시간


def _cache_age_seconds() -> float:
    """캐시 파일이 몇 초 전에 갱신됐는지 반환. 파일 없으면 무한대."""
    if not _CACHE_FILE.exists():
        return float("inf")
    try:
        payload = json.loads(_CACHE_FILE.read_text(encoding="utf-8"))
        updated_at = datetime.fromisoformat(payload.get("updated_at", "2000-01-01"))
        return (datetime.now() - updated_at).total_seconds()
    except Exception:
        return float("inf")


async def _run_refresh() -> bool:
    """refresh_stocks.py를 실행하고 성공 여부를 반환."""
    try:
        proc = await asyncio.create_subprocess_exec(
            sys.executable, str(_REFRESH_SCRIPT),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode == 0:
            print("[STOCKS] 종목 캐시 갱신 완료")
            return True
        print(f"[STOCKS] 갱신 실패: {stderr.decode(errors='replace')[:200]}")
    except Exception as exc:
        print(f"[STOCKS] 갱신 오류: {exc}")
    return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    import db as _db
    _db.init_db()
    print("[STARTUP] SQLite 캐시 DB 초기화 완료")

    # stock_data는 module import 시점에 fallback/cache를 로드한다.
    # 여기서는 우선 현재 로드 상태를 확인하고, 비어있을 때만 동기 refresh를 시도한다.
    import stock_data as _sd
    initial_total = len(_sd.KOSPI_STOCKS) + len(_sd.KOSDAQ_STOCKS)
    age = _cache_age_seconds()

    if initial_total == 0:
        # fallback도 캐시도 없음 → 동기 갱신
        print("[STOCKS] 종목 데이터 없음 — 전체 종목 조회 중 (30초 내외)...")
        if await _run_refresh():
            # refresh 성공 → stock_data 재로드 (module-level 변수 갱신)
            kospi, kosdaq = _sd._load_stocks()
            _sd.KOSPI_STOCKS = kospi
            _sd.KOSDAQ_STOCKS = kosdaq
            _sd.MARKET_STOCKS = {"코스피": kospi, "코스닥": kosdaq, "전체": kospi + kosdaq}
            _sd.STOCK_MAP = {s.code: s for s in kospi + kosdaq}
    elif age == float("inf"):
        # fallback으로는 가동 중이지만 캐시가 없음 → 백그라운드 갱신
        print(f"[STOCKS] fallback {initial_total}개로 가동 중 — 백그라운드에서 최신 캐시 생성")
        asyncio.ensure_future(_run_refresh())
    elif age > _CACHE_MAX_AGE_SECONDS:
        # 캐시 오래됨 → 백그라운드 갱신
        print(f"[STOCKS] 캐시 {age/3600:.1f}h 경과 — 백그라운드 갱신 시작")
        asyncio.ensure_future(_run_refresh())

    total = len(_sd.KOSPI_STOCKS) + len(_sd.KOSDAQ_STOCKS)
    print(f"[STARTUP] 종목: 코스피 {len(_sd.KOSPI_STOCKS)} + 코스닥 {len(_sd.KOSDAQ_STOCKS)} = {total}개")

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
