"""종목 마스터 데이터 — JSON 캐시에서 동적 로드.

캐시 갱신: python backend/scripts/refresh_stocks.py
"""
from __future__ import annotations

import json
from pathlib import Path

from models import Stock

_DATA_DIR = Path(__file__).resolve().parent / "data"
_CACHE_PATH = _DATA_DIR / "stocks_cache.json"
_FALLBACK_PATH = _DATA_DIR / "stocks_fallback.json"


def _load_stocks() -> tuple[list[Stock], list[Stock]]:
    for path in [_CACHE_PATH, _FALLBACK_PATH]:
        if not path.exists():
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            kospi: list[Stock] = []
            kosdaq: list[Stock] = []
            for item in payload.get("stocks", []):
                s = Stock(
                    code=item["code"],
                    name=item["name"],
                    market=item["market"],
                    sector=item.get("sector", ""),
                    base_price=item.get("base_price", 0),
                )
                if s.market == "코스피":
                    kospi.append(s)
                else:
                    kosdaq.append(s)
            # 캐시가 비어있으면(예: 이전 갱신 실패로 빈 파일이 남은 경우) fallback 시도
            if not kospi and not kosdaq:
                print(f"[STOCKS] {path.name} 비어있음 — 다음 소스 시도", flush=True)
                continue
            print(f"[STOCKS] {path.name} 로드: 코스피 {len(kospi)} + 코스닥 {len(kosdaq)}", flush=True)
            return kospi, kosdaq
        except Exception as exc:
            print(f"[STOCKS] {path.name} 파싱 실패: {exc}", flush=True)
            continue
    return [], []


KOSPI_STOCKS, KOSDAQ_STOCKS = _load_stocks()

MARKET_STOCKS: dict[str, list[Stock]] = {
    "코스피": KOSPI_STOCKS,
    "코스닥": KOSDAQ_STOCKS,
    "전체": KOSPI_STOCKS + KOSDAQ_STOCKS,
}

STOCK_MAP: dict[str, Stock] = {s.code: s for s in KOSPI_STOCKS + KOSDAQ_STOCKS}

PERIODS: dict[str, int] = {
    "5일": 5, "2주": 10, "1개월": 22, "3개월": 65,
    "6개월": 130, "1년": 252, "2년": 504,
}
