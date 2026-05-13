"""시장 요약 라우터 — 상단 티커용 주요 지표.

데이터 소스: Naver 금융 비공식 API
- 한국 종목: https://polling.finance.naver.com/api/realtime/domestic/stock/{code}
- 글로벌 지수: https://api.stock.naver.com/index/{code}/basic
- 시장지표(환율/원자재/국채): https://m.stock.naver.com/front-api/marketIndex/prices

Render 등 데이터센터 IP에서 KRX/Yahoo Finance가 차단되는 문제를 회피하기 위해
같은 한국 인프라(Naver)를 사용한다.
"""
from __future__ import annotations

import sys, os, time, logging
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import requests as _requests
from fastapi import APIRouter
from kis_client import KISError
from kis_service import kis_available, live_snapshot
from stock_data import STOCK_MAP
from utils import stock_demo_snapshot, seed_for

logger = logging.getLogger(__name__)

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

# 글로벌 지수: (Naver category, reutersCode, 표시명, 소수점, kind)
# kind: "index" = api.stock.naver.com/index/{code}/basic
#       "marketindex" = m.stock.naver.com/front-api/marketIndex/prices
GLOBAL_INDICES = [
    ("exchange",  "FX_USDKRW", "원/달러",      2, "marketindex"),
    ("-",         ".IXIC",     "나스닥",       2, "index"),
    ("-",         ".INX",      "S&P 500",      2, "index"),
    ("energy",    "CLcv1",     "WTI 원유",     2, "marketindex"),
    ("metals",    "GCcv1",     "금",           2, "marketindex"),
    ("bond",      "KR10YT=RR", "10년물 국채",  3, "marketindex"),
]

_NAVER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://m.stock.naver.com/",
    "Accept": "application/json",
}

# 한국 종목 캐시 (30초 TTL — Naver pollingInterval이 70초이므로 여유 있게)
_domestic_cache: dict = {}
_domestic_cache_ts: float = 0.0
_DOMESTIC_TTL = 30

# 글로벌 지수 캐시 (60초 TTL — 프론트 폴링 주기와 일치)
_global_cache: list = []
_global_cache_ts: float = 0.0
_GLOBAL_TTL = 60


def _parse_num(s) -> float:
    """'1,488.60' 또는 '-185.92' → float."""
    if isinstance(s, (int, float)):
        return float(s)
    return float(str(s).replace(",", "").replace(" ", ""))


def _apply_sign(value: float, fluc_code: str) -> float:
    """fluctuationsType.code 기반 부호 적용. '5'=하락→음수, '2'=상승→양수."""
    av = abs(value)
    if fluc_code == "5":
        return -av
    if fluc_code == "2":
        return av
    return 0.0 if av < 1e-9 else value  # 보합("3") 또는 알 수 없음 → 원본 유지


def _fetch_naver_domestic(code: str) -> dict | None:
    """Naver polling API로 한국 종목 실시간 시세 조회."""
    url = f"https://polling.finance.naver.com/api/realtime/domestic/stock/{code}"
    try:
        r = _requests.get(url, headers=_NAVER_HEADERS, timeout=5)
        r.raise_for_status()
        data = r.json()
        item = data["datas"][0]
        price = int(_parse_num(item["closePrice"]))
        change_raw = _parse_num(item["compareToPreviousClosePrice"])
        rate_raw = _parse_num(item["fluctuationsRatio"])
        fluc_code = (item.get("compareToPreviousPrice") or {}).get("code", "3")
        change = int(_apply_sign(change_raw, fluc_code))
        change_rate = round(_apply_sign(rate_raw, fluc_code), 2)
        return {"price": price, "change": change, "change_rate": change_rate}
    except Exception as e:
        logger.warning(f"naver domestic {code} failed: {type(e).__name__}: {e}")
        return None


def _get_domestic_snapshots(codes: list[str]) -> dict[str, dict]:
    """8개 종목 일괄 조회 + 캐시."""
    global _domestic_cache, _domestic_cache_ts
    now = time.time()
    if now - _domestic_cache_ts < _DOMESTIC_TTL and _domestic_cache:
        return _domestic_cache

    result: dict[str, dict] = {}
    for code in codes:
        snap = _fetch_naver_domestic(code)
        if snap:
            result[code] = snap

    if result:
        _domestic_cache = result
        _domestic_cache_ts = now
    return result


def _fetch_naver_index(code: str, decimals: int) -> dict | None:
    """Naver 글로벌 지수 (NASDAQ, S&P 500 등)."""
    url = f"https://api.stock.naver.com/index/{code}/basic"
    try:
        r = _requests.get(url, headers=_NAVER_HEADERS, timeout=5)
        r.raise_for_status()
        d = r.json()
        price = round(_parse_num(d["closePrice"]), decimals)
        change = round(_parse_num(d["compareToPreviousClosePrice"]), decimals)
        change_rate = round(_parse_num(d["fluctuationsRatio"]), 2)
        return {"price": price, "change": change, "change_rate": change_rate}
    except Exception as e:
        logger.warning(f"naver index {code} failed: {type(e).__name__}: {e}")
        return None


def _fetch_naver_marketindex(category: str, code: str, decimals: int) -> dict | None:
    """Naver 시장지표 (환율, 원자재, 채권)."""
    url = "https://m.stock.naver.com/front-api/marketIndex/prices"
    params = {"category": category, "reutersCode": code, "pageSize": 10, "page": 1}
    try:
        r = _requests.get(url, params=params, headers=_NAVER_HEADERS, timeout=5)
        r.raise_for_status()
        d = r.json()
        if not d.get("isSuccess") or not d.get("result"):
            logger.warning(f"naver marketindex {category}/{code} empty result")
            return None
        first = d["result"][0]
        price = round(_parse_num(first["closePrice"]), decimals)
        fluc_raw = _parse_num(first["fluctuations"])
        rate_raw = _parse_num(first["fluctuationsRatio"])
        fluc_code = (first.get("fluctuationsType") or {}).get("code", "3")
        change = round(_apply_sign(fluc_raw, fluc_code), decimals)
        change_rate = round(_apply_sign(rate_raw, fluc_code), 2)
        return {"price": price, "change": change, "change_rate": change_rate}
    except Exception as e:
        logger.warning(f"naver marketindex {category}/{code} failed: {type(e).__name__}: {e}")
        return None


def _demo_global(symbol: str, decimals: int) -> dict:
    """날짜 기반 결정론적 데모값 (요청마다 동일) — 모든 실데이터 소스 실패 시만 사용."""
    from datetime import date
    day_seed = seed_for(symbol, str(date.today()))
    bases = {
        "FX_USDKRW": 1370.0, ".IXIC": 19200.0, ".INX": 5500.0,
        "CLcv1": 76.0, "GCcv1": 3300.0, "KR10YT=RR": 4.45,
    }
    base = bases.get(symbol, 100.0)
    noise = ((day_seed % 200) - 100) / 1000
    price = round(base * (1 + noise), decimals)
    change_seed = seed_for(symbol, str(date.today()), "chg")
    change_pct = ((change_seed % 300) - 150) / 10000
    change = round(price * change_pct, decimals)
    change_rate = round(change / (price - change) * 100, 2) if (price - change) else 0.0
    return {"price": price, "change": change, "change_rate": change_rate}


def _get_global_indices() -> tuple[list[dict], bool]:
    """글로벌 지수 6종 반환. 두 번째 값은 '하나라도 실데이터 성공'."""
    global _global_cache, _global_cache_ts
    now = time.time()
    if now - _global_cache_ts < _GLOBAL_TTL and _global_cache:
        # 캐시된 결과의 demo 여부는 _global_cache_live에 저장
        return _global_cache, _global_cache_live

    results = []
    any_live_local = False
    for category, code, name, decimals, kind in GLOBAL_INDICES:
        if kind == "index":
            data = _fetch_naver_index(code, decimals)
        else:
            data = _fetch_naver_marketindex(category, code, decimals)

        if data is not None:
            any_live_local = True
        else:
            data = _demo_global(code, decimals)

        results.append({
            "code": code,
            "name": name,
            "price": data["price"],
            "change": data["change"],
            "change_rate": data["change_rate"],
        })

    _global_cache = results
    _global_cache_ts = now
    globals()["_global_cache_live"] = any_live_local
    return results, any_live_local


_global_cache_live: bool = False


@router.get("/summary")
def market_summary():
    """상단 티커용 주요 종목 + 글로벌 지수 시세 반환."""
    items = []
    any_live = False

    # 1순위: Naver 한국 종목 실데이터
    codes = [code for code, _ in TICKER_STOCKS]
    naver_data = _get_domestic_snapshots(codes)
    if naver_data:
        any_live = True

    kis_live = kis_available()

    for code, label in TICKER_STOCKS:
        stock = STOCK_MAP.get(code)
        if not stock:
            continue

        snap = naver_data.get(code)
        # 2순위: KIS 실데이터
        if snap is None and kis_live:
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

    global_items, global_live = _get_global_indices()
    if global_live:
        any_live = True
    items.extend(global_items)

    return {"live": any_live, "items": items}
