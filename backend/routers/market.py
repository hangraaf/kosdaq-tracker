"""시장 요약 라우터 — 상단 티커용 주요 지표."""
from __future__ import annotations

import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import requests as _requests
from datetime import datetime, timedelta
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

# 글로벌 지수 인메모리 캐시 (1분 TTL — 프론트엔드 폴링 주기와 맞춤)
_global_cache: dict = {}
_global_cache_ts: float = 0.0
_GLOBAL_TTL = 60  # 1분

# Yahoo Finance 세션/crumb 캐시
_yf_session: _requests.Session | None = None
_yf_crumb: str = ""
_yf_crumb_ts: float = 0.0
_YF_CRUMB_TTL = 3600  # crumb 1시간 재사용

# pykrx 한국 종목 캐시 (느린 HTTP 스크래핑이므로 5분 TTL)
_pykrx_cache: dict = {}
_pykrx_cache_ts: float = 0.0
_PYKRX_TTL = 300  # 5분


def _refresh_yf_crumb() -> tuple[_requests.Session, str]:
    """Yahoo Finance 세션과 crumb을 갱신한다."""
    global _yf_session, _yf_crumb, _yf_crumb_ts
    now = time.time()
    if _yf_session and _yf_crumb and now - _yf_crumb_ts < _YF_CRUMB_TTL:
        return _yf_session, _yf_crumb

    session = _requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    })
    crumb = ""
    try:
        session.get("https://fc.yahoo.com", timeout=5)
        r = session.get("https://query2.finance.yahoo.com/v1/test/getcrumb", timeout=5)
        if r.status_code == 200 and r.text.strip():
            crumb = r.text.strip()
    except Exception:
        pass

    _yf_session = session
    _yf_crumb = crumb
    _yf_crumb_ts = now
    return session, crumb


def _fetch_yahoo(symbol: str) -> dict | None:
    """Yahoo Finance API로 시세 조회 (crumb 인증 포함)."""
    global _yf_session, _yf_crumb, _yf_crumb_ts
    for attempt in range(2):  # crumb 만료 시 1회 재시도
        try:
            session, crumb = _refresh_yf_crumb()
            url = f"https://query2.finance.yahoo.com/v8/finance/chart/{symbol}"
            params: dict = {}
            if crumb:
                params["crumb"] = crumb
            r = session.get(url, params=params, timeout=5)
            if r.status_code == 401 and attempt == 0:
                # crumb 만료 → 강제 갱신 후 재시도
                _yf_crumb = ""
                _yf_crumb_ts = 0.0
                continue
            r.raise_for_status()
            meta = r.json()["chart"]["result"][0]["meta"]
            price = float(meta["regularMarketPrice"])
            prev = float(meta.get("chartPreviousClose") or meta.get("previousClose") or price)
            change = price - prev
            change_rate = (change / prev * 100) if prev else 0.0
            return {"price": price, "change": change, "change_rate": change_rate}
        except Exception:
            if attempt == 0:
                _yf_crumb = ""
                _yf_crumb_ts = 0.0
            continue
    return None


def _get_pykrx_snapshots(codes: list[str]) -> dict[str, dict]:
    """pykrx로 한국 종목 현재가를 배치 조회한다 (KIS 키 불필요)."""
    global _pykrx_cache, _pykrx_cache_ts
    now = time.time()
    if now - _pykrx_cache_ts < _PYKRX_TTL and _pykrx_cache:
        return _pykrx_cache

    try:
        import pykrx.stock as pykrx_stock
        import pandas as pd

        end = datetime.now().strftime("%Y%m%d")
        start = (datetime.now() - timedelta(days=7)).strftime("%Y%m%d")

        frames = []
        for market in ("KOSPI", "KOSDAQ"):
            try:
                df = pykrx_stock.get_market_price_change_by_ticker(start, end, market=market)
                if df is not None and not df.empty:
                    frames.append(df)
            except Exception:
                pass

        if not frames:
            return {}

        combined = pd.concat(frames)
        # pykrx 컬럼명: 시가 고가 저가 종가 거래량 거래대금 등락률 변동폭
        result: dict[str, dict] = {}
        for code in codes:
            if code in combined.index:
                row = combined.loc[code]
                try:
                    price = int(row.get("종가", row.iloc[3]))
                    change_rate = float(row.get("등락률", row.iloc[6]))
                    change = int(row.get("변동폭", round(price * change_rate / 100)))
                    result[code] = {
                        "price": price,
                        "change": change,
                        "change_rate": round(change_rate, 2),
                    }
                except Exception:
                    pass

        _pykrx_cache = result
        _pykrx_cache_ts = now
        return result
    except Exception:
        return {}


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
    any_live = False

    # pykrx로 한국 종목 배치 조회 (KIS 키 불필요)
    codes = [code for code, _ in TICKER_STOCKS]
    pykrx_data = _get_pykrx_snapshots(codes)
    if pykrx_data:
        any_live = True

    kis_live = kis_available()

    for code, label in TICKER_STOCKS:
        stock = STOCK_MAP.get(code)
        if not stock:
            continue

        snap = None
        # 1순위: pykrx 실데이터
        if code in pykrx_data:
            snap = pykrx_data[code]
        # 2순위: KIS 실데이터
        elif kis_live:
            try:
                snap = live_snapshot(code)
                any_live = True
            except (KISError, Exception):
                snap = None
        # 3순위: demo fallback
        if snap is None:
            snap = stock_demo_snapshot(code, stock.name, stock.market, stock.sector, stock.base_price)

        items.append({
            "code": code,
            "name": label,
            "price": snap["price"],
            "change": snap["change"],
            "change_rate": snap["change_rate"],
        })

    items.extend(_get_global_indices())

    return {"live": any_live, "items": items}
