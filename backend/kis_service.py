"""KIS API 서비스 레이어 — SQLite DB 캐시 우선, KIS API fallback."""
from __future__ import annotations

import time
from pathlib import Path

import pandas as pd

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import db
from config import DATA_DIR, settings
from kis_client import KISClient, KISConfig, KISError

TOKEN_FILE = DATA_DIR / "kis_token.json"

_client: KISClient | None = None
_client_checked_at: float = 0.0
_CLIENT_TTL = 60.0


def get_kis_client() -> KISClient | None:
    global _client, _client_checked_at
    now = time.time()
    if now - _client_checked_at < _CLIENT_TTL:
        return _client
    _client_checked_at = now
    key = settings.kis_app_key.strip()
    secret = settings.kis_app_secret.strip()
    if not key or not secret:
        _client = None
        return None
    cfg = KISConfig(app_key=key, app_secret=secret, env=settings.kis_env)
    _client = KISClient(cfg, TOKEN_FILE)
    return _client


def kis_available() -> bool:
    return get_kis_client() is not None


# ── 주가 스냅샷 (DB 캐시 → KIS API) ─────────────────────────────────────

def live_snapshot(code: str) -> dict:
    # 1. DB 캐시
    cached = db.get_price(code)
    if cached:
        return cached

    # 2. KIS API 호출
    client = get_kis_client()
    if not client:
        raise KISError("KIS API 키가 설정되어 있지 않습니다.")
    data = client.inquire_price(code)

    # 3. DB 저장
    db.set_price(code, data)
    return data


# ── 차트 (DB 캐시 → KIS API) ─────────────────────────────────────────────

def live_chart(code: str, days: int) -> pd.DataFrame:
    cache_key = f"{code}:{days}"

    # 1. DB 캐시 — date 열은 문자열로 저장되므로 datetime으로 복원
    cached_rows = db.get_chart(cache_key)
    if cached_rows is not None:
        df = pd.DataFrame(cached_rows)
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
        return df

    # 2. KIS API 호출
    client = get_kis_client()
    if not client:
        raise KISError("KIS API 키가 설정되어 있지 않습니다.")
    df = client.daily_chart(code, days)

    # 3. DB 저장 (date → 문자열 직렬화)
    records = df.assign(date=df["date"].dt.strftime("%Y-%m-%d")).to_dict(orient="records")
    db.set_chart(cache_key, records)
    return df
