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

def live_investor_flow(code: str, days: int = 20) -> dict:
    """투자자별 수급 — 최근 N영업일 누적 + 시계열 (억원 환산).

    KIS inquire-investor 응답 필드:
      stck_bsop_date, prsn_ntby_tr_pbmn(개인), frgn_ntby_tr_pbmn(외국인), orgn_ntby_tr_pbmn(기관)
    """
    client = get_kis_client()
    if not client:
        raise KISError("KIS API 키가 설정되어 있지 않습니다.")
    rows = client.inquire_investor(code)
    # 최신순 응답을 최근 N영업일만 잘라서 사용
    rows = rows[:days]

    def _to_eok(value) -> int:
        # 원 → 억원 (반올림)
        try:
            return round(int(str(value).replace(",", "").strip()) / 100_000_000)
        except (TypeError, ValueError):
            return 0

    series = []
    f_sum = i_sum = p_sum = 0
    for r in rows:
        f = _to_eok(r.get("frgn_ntby_tr_pbmn"))
        ins = _to_eok(r.get("orgn_ntby_tr_pbmn"))
        ind = _to_eok(r.get("prsn_ntby_tr_pbmn"))
        date_str = str(r.get("stck_bsop_date") or "")
        if len(date_str) == 8:
            date_str = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
        series.append({"date": date_str, "foreign": f, "institution": ins, "individual": ind})
        f_sum += f
        i_sum += ins
        p_sum += ind

    # 외국인 지분율은 inquire_price의 hts_frgn_ehrt를 활용
    foreign_ratio = 0.0
    try:
        snap_raw = client.inquire_price(code)
        foreign_ratio = float(snap_raw.get("foreign_ratio") or 0.0)
    except KISError:
        pass

    # 오래된 날짜가 먼저 오도록 뒤집어서 반환 (차트용)
    series.reverse()

    return {
        "days": len(series),
        "foreign_sum": f_sum,
        "institution_sum": i_sum,
        "individual_sum": p_sum,
        "foreign_ratio": foreign_ratio,
        "series": series,
        "source": "KIS",
    }


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
