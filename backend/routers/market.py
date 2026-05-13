"""시장 요약 라우터 — 상단 티커용 주요 지표."""
from __future__ import annotations

import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import requests as _requests
from fastapi import APIRouter
from kis_client import KISError
from kis_service import kis_available, live_snapshot
from stock_data import STOCK_MAP
from utils import stock_demo_snapshot, seed_for

router = APIRouter(prefix="/market", tags=["market"])

# 티커에 표시할 주요 종목 (코드, 표시명)
TICKER_STOCKS = [
    ("005930", "삼성전자"),
    ("000660", "SK하이닉스"),
    ("005380", "현대차"),
    ("035420", "NAVER"),
    ("373220", "LG에너지솔루션"),
    ("247540", "에코프로비엠"),
    ("012450", "한화에어로스페이스"),
    ("035720", "카카오"),
]

# 글로벌 지수 (Yahoo Finance 심볼, 표시명, 소수점 자리수)
GLOBAL_INDICES = [
    ("USDKRW=X", "원/달러", 2),
    ("^IXIC",    "나스닥",  2),
    ("^GSPC",    "S&P 500", 2),
    ("CL=F",     "WTI 원유", 2),
    ("GC=F",     "금",       2),
    ("^TNX",     "10년물 국채", 3),
]

# 글로벌 지수 인메모리 캐시 (5분 TTL)
_global_cache: dict = {}
_global_cache_ts: float = 0.0
_GLOBAL_TTL = 300  # 5분


def _fetch_yahoo(symbol: str) -> dict | None:
    """Yahoo Finance 비공식 API로 시세 조회."""
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        r = _requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=5)
        r.raise_for_status()
        meta = r.json()["chart"]["result"][0]["meta"]
        price = float(meta["regularMarketPrice"])
        prev = float(meta.get("chartPreviousClose") or meta.get("previousClose") or price)
        change = price - prev
        change_rate = (change / prev * 100) if prev else 0.0
        return {"price": price, "change": change, "change_rate": change_rate}
    except Exception:
        return None


def _demo_global(symbol: str, name: str, decimals: int) -> dict:
    """날짜 기반 결정론적 데모값 (요청마다 동일)."""
    from datetime import date
    day_seed = seed_for(symbol, str(date.today()))
    bases = {
        "USDKRW=X": 1370.0, "^IXIC": 19200.0, "^GSPC": 5500.0,
        "CL=F": 76.0, "GC=F": 3300.0, "^TNX": 4.45,
    }
    base = bases.get(symbol, 100.0)
    noise = ((day_seed % 200) - 100) / 1000  # ±10%
    price = round(base * (1 + noise), decimals)
    change_seed = seed_for(symbol, str(date.today()), "chg")
    change_pct = ((change_seed % 300) - 150) / 10000  # ±1.5%
    change = round(price * change_pct, decimals)
    change_rate = round(change / (price - change) * 100, 2)
    return {"price": price, "change": change, "change_rate": change_rate}


def _get_global_indices() -> list[dict]:
    global _global_cache, _global_cache_ts
    now = time.time()
    if now - _global_cache_ts < _GLOBAL_TTL and _global_cache:
        return list(_global_cache.values())

    results = []
    new_cache: dict = {}
    for symbol, name, decimals in GLOBAL_INDICES:
        data = _fetch_yahoo(symbol)
        if data is None:
            data = _demo_global(symbol, name, decimals)
        entry = {
            "code": symbol,
            "name": name,
            "price": round(data["price"], decimals),
            "change": round(data["change"], decimals),
            "change_rate": round(data["change_rate"], 2),
        }
        new_cache[symbol] = entry
        results.append(entry)

    _global_cache = new_cache
    _global_cache_ts = now
    return results


@router.get("/summary")
def market_summary():
    """상단 티커용 주요 종목 + 글로벌 지수 시세 반환."""
    items = []
    live = kis_available()

    for code, label in TICKER_STOCKS:
        stock = STOCK_MAP.get(code)
        if not stock:
            continue
        try:
            if live:
                snap = live_snapshot(code)
            else:
                snap = stock_demo_snapshot(code, stock.name, stock.market, stock.sector, stock.base_price)
        except (KISError, Exception):
            snap = stock_demo_snapshot(code, stock.name, stock.market, stock.sector, stock.base_price)

        items.append({
            "code": code,
            "name": label,
            "price": snap["price"],
            "change": snap["change"],
            "change_rate": snap["change_rate"],
        })

    items.extend(_get_global_indices())

    return {"live": live, "items": items}
