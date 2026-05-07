"""KIS API 서비스 레이어 — 싱글턴 + TTL 캐시."""
from __future__ import annotations

import time
from functools import lru_cache
from pathlib import Path

import pandas as pd

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from config import DATA_DIR, settings
from kis_client import KISClient, KISConfig, KISError

TOKEN_FILE = DATA_DIR / "kis_token.json"

_client: KISClient | None = None
_client_checked_at: float = 0.0
_CLIENT_TTL = 60.0  # 60초마다 재확인


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


# ── TTL 캐시 ──────────────────────────────────────────────────────────────
_snapshot_cache: dict[str, tuple[float, dict]] = {}
_chart_cache: dict[str, tuple[float, pd.DataFrame]] = {}

SNAPSHOT_TTL = 5   # 5초
CHART_TTL    = 60  # 1분


def live_snapshot(code: str) -> dict:
    now = time.time()
    cached = _snapshot_cache.get(code)
    if cached and now - cached[0] < SNAPSHOT_TTL:
        return cached[1]
    client = get_kis_client()
    if not client:
        raise KISError("KIS API 키가 설정되어 있지 않습니다.")
    data = client.inquire_price(code)
    _snapshot_cache[code] = (now, data)
    return data


def live_chart(code: str, days: int) -> pd.DataFrame:
    key = f"{code}:{days}"
    now = time.time()
    cached = _chart_cache.get(key)
    if cached and now - cached[0] < CHART_TTL:
        return cached[1]
    client = get_kis_client()
    if not client:
        raise KISError("KIS API 키가 설정되어 있지 않습니다.")
    df = client.daily_chart(code, days)
    _chart_cache[key] = (now, df)
    return df
