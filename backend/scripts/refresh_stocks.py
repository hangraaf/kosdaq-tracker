"""KRX 전체 종목 목록을 FinanceDataReader로 조회해 data/stocks_cache.json에 저장한다.

사용법:
    python backend/scripts/refresh_stocks.py

또는 backend/ 디렉토리 안에서:
    python scripts/refresh_stocks.py
"""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CACHE_PATH = DATA_DIR / "stocks_cache.json"
FALLBACK_PATH = DATA_DIR / "stocks_fallback.json"


def _load_fallback_sectors() -> dict[str, dict]:
    """fallback JSON에서 섹터·기준가를 {code: {sector, base_price}} 형태로 반환."""
    if not FALLBACK_PATH.exists():
        return {}
    try:
        payload = json.loads(FALLBACK_PATH.read_text(encoding="utf-8"))
        return {
            s["code"]: {"sector": s.get("sector", ""), "base_price": s.get("base_price", 0)}
            for s in payload.get("stocks", [])
            if s.get("code")
        }
    except Exception:
        return {}


def fetch_all_stocks() -> list[dict]:
    try:
        import FinanceDataReader as fdr
    except ImportError:
        print("오류: FinanceDataReader가 설치되어 있지 않습니다. pip install finance-datareader", file=sys.stderr)
        sys.exit(1)

    result: list[dict] = []

    for market_en, market_ko in [("KOSPI", "코스피"), ("KOSDAQ", "코스닥")]:
        print(f"{market_ko} 종목 목록 조회 중...", end="", flush=True)
        try:
            df = fdr.StockListing(market_en)
        except Exception as exc:
            print(f"\n{market_ko} 조회 실패: {exc}", file=sys.stderr)
            continue

        for _, row in df.iterrows():
            code = str(row.get("Code", "")).strip()
            name = str(row.get("Name", "")).strip()
            if not code or not name:
                continue
            sector = str(row.get("Sector", row.get("Industry", "")) or "").strip()
            base_price = int(float(row.get("Close", row.get("Price", 0)) or 0))
            result.append({
                "code": code,
                "name": name,
                "market": market_ko,
                "sector": sector,
                "base_price": base_price,
            })

        print(f" {len(df)}개 완료")

    return result


def main() -> None:
    DATA_DIR.mkdir(exist_ok=True)

    # fallback에서 섹터 사전 로드
    fallback_sectors = _load_fallback_sectors()
    if fallback_sectors:
        print(f"fallback 섹터 데이터: {len(fallback_sectors)}개 종목")

    stocks = fetch_all_stocks()
    if not stocks:
        print("조회된 종목이 없습니다. 네트워크 연결을 확인하세요.", file=sys.stderr)
        sys.exit(1)

    # fallback 섹터·기준가를 캐시에 병합 (FDR에서 못 가져온 경우 보완)
    enriched = 0
    for s in stocks:
        fb = fallback_sectors.get(s["code"])
        if fb:
            if not s["sector"] and fb["sector"]:
                s["sector"] = fb["sector"]
                enriched += 1
            if not s["base_price"] and fb["base_price"]:
                s["base_price"] = fb["base_price"]
    if enriched:
        print(f"fallback에서 섹터 보완: {enriched}개 종목")

    payload = {
        "updated_at": datetime.now().isoformat(),
        "stocks": stocks,
    }
    CACHE_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    with_sector = sum(1 for s in stocks if s["sector"])
    print(f"\n저장 완료: {len(stocks)}개 종목 (섹터 있음: {with_sector}개) → {CACHE_PATH}")


if __name__ == "__main__":
    main()
