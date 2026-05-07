"""종목 조회 라우터 — demo / KIS live 자동 전환."""
from __future__ import annotations

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi import APIRouter, HTTPException, Query

from kis_client import KISError
from kis_service import kis_available, live_chart, live_snapshot
from models import StockSnapshot
from stock_data import MARKET_STOCKS, PERIODS, STOCK_MAP
from utils import generate_demo_ohlcv, stock_demo_snapshot

router = APIRouter(prefix="/stocks", tags=["stocks"])


def _snapshot(code: str) -> dict:
    stock = STOCK_MAP.get(code)
    if not stock:
        raise HTTPException(404, detail=f"종목 코드 {code}를 찾을 수 없습니다.")
    if kis_available():
        try:
            live = live_snapshot(code)
            return {
                "code": code, "name": stock.name,
                "market": stock.market, "sector": stock.sector,
                **live,
            }
        except KISError:
            pass
    return stock_demo_snapshot(code, stock.name, stock.market, stock.sector, stock.base_price)


@router.get("/status")
def api_status():
    """KIS API 연결 상태 반환."""
    return {"live": kis_available(), "mode": "LIVE" if kis_available() else "DEMO"}


@router.get("/")
def list_stocks(
    market: str = Query("전체"),
    sector: str | None = Query(None),
    q: str | None = Query(None),
):
    stocks = MARKET_STOCKS.get(market, MARKET_STOCKS["전체"])
    if sector:
        stocks = [s for s in stocks if sector in s.sector]
    if q:
        q_lower = q.lower()
        stocks = [s for s in stocks if q_lower in s.name.lower() or q_lower in s.code]
    return [{"code": s.code, "name": s.name, "market": s.market,
             "sector": s.sector, "base_price": s.base_price} for s in stocks]


@router.get("/sectors")
def list_sectors(market: str = Query("전체")):
    stocks = MARKET_STOCKS.get(market, MARKET_STOCKS["전체"])
    return list(dict.fromkeys(s.sector for s in stocks))


@router.get("/today/top")
def today_top(market: str = Query("전체"), limit: int = Query(10, le=50)):
    stocks = MARKET_STOCKS.get(market, MARKET_STOCKS["전체"])
    results = [stock_demo_snapshot(s.code, s.name, s.market, s.sector, s.base_price) for s in stocks]
    results.sort(key=lambda x: -x["change_rate"])
    return {"live": False, "items": results[:limit]}


@router.get("/{code}/snapshot", response_model=StockSnapshot)
def snapshot(code: str):
    return _snapshot(code)


@router.get("/{code}/chart")
def chart(code: str, period: str = Query("1개월")):
    stock = STOCK_MAP.get(code)
    if not stock:
        raise HTTPException(404, detail=f"종목 코드 {code}를 찾을 수 없습니다.")
    days = PERIODS.get(period, 22)
    live = False
    if kis_available():
        try:
            df = live_chart(code, days)
            live = True
            records = df.assign(date=df["date"].dt.strftime("%Y-%m-%d")).to_dict(orient="records")
            return {"live": True, "items": records}
        except KISError:
            pass
    df = generate_demo_ohlcv(code, stock.base_price, days)
    return {"live": False, "items": df.to_dict(orient="records")}
