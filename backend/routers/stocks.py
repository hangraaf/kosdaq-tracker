"""종목 조회 라우터 — demo / KIS live 자동 전환."""
from __future__ import annotations

import asyncio
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import numpy as np
from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect

from kis_client import KISError
from kis_realtime import get_realtime_manager
from kis_service import get_kis_client, kis_available, live_chart, live_snapshot
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
def today_top(market: str = Query("전체"), limit: int = Query(10, le=500)):
    all_stocks = MARKET_STOCKS.get(market, MARKET_STOCKS["전체"])
    results = []
    live_mode = False

    if kis_available():
        live_mode = True
        # KIS API는 limit 범위 내에서만 실시간 조회 (과도한 호출 방지)
        for s in all_stocks[:limit]:
            try:
                snap = live_snapshot(s.code)
                results.append({
                    "code": s.code, "name": s.name,
                    "market": s.market, "sector": s.sector,
                    **snap,
                })
            except KISError:
                results.append(stock_demo_snapshot(s.code, s.name, s.market, s.sector, s.base_price))
        # limit 초과분은 데모로 채움
        for s in all_stocks[limit:]:
            results.append(stock_demo_snapshot(s.code, s.name, s.market, s.sector, s.base_price))
    else:
        results = [stock_demo_snapshot(s.code, s.name, s.market, s.sector, s.base_price) for s in all_stocks]

    return {"live": live_mode, "items": results}


@router.websocket("/ws/{code}")
async def stock_ws(websocket: WebSocket, code: str):
    """KIS 실시간 주가 스트리밍 WebSocket."""
    await websocket.accept()

    if code not in STOCK_MAP:
        await websocket.send_json({"error": f"종목 코드 {code}를 찾을 수 없습니다."})
        await websocket.close()
        return

    if not kis_available():
        await websocket.send_json({"error": "KIS API 키 미설정 — 실시간 스트리밍 불가"})
        await websocket.close()
        return

    client = get_kis_client()
    try:
        approval_key = client.get_approval_key()
    except KISError as e:
        await websocket.send_json({"error": str(e)})
        await websocket.close()
        return

    from config import settings
    manager = get_realtime_manager()
    await manager.start(approval_key, settings.kis_env)

    queue: asyncio.Queue = asyncio.Queue(maxsize=30)
    await manager.subscribe(code, queue)
    try:
        while True:
            try:
                data = await asyncio.wait_for(queue.get(), timeout=30.0)
                await websocket.send_json(data)
            except asyncio.TimeoutError:
                await websocket.send_json({"ping": True})
    except WebSocketDisconnect:
        pass
    finally:
        await manager.unsubscribe(code, queue)


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


@router.get("/{code}/indicators")
def indicators(code: str, period: str = Query("3개월")):
    """RSI · MACD · 볼린저밴드 지표 반환."""
    stock = STOCK_MAP.get(code)
    if not stock:
        raise HTTPException(404, detail=f"종목 코드 {code}를 찾을 수 없습니다.")
    days = PERIODS.get(period, 65)
    if kis_available():
        try:
            df = live_chart(code, days)
        except KISError:
            df = generate_demo_ohlcv(code, stock.base_price, days)
    else:
        df = generate_demo_ohlcv(code, stock.base_price, days)

    closes = df["close"].astype(float).values
    dates  = df["date"].tolist() if isinstance(df["date"].iloc[0], str) else [d.strftime("%Y-%m-%d") for d in df["date"]]

    # RSI (14)
    delta = np.diff(closes, prepend=closes[0])
    gain  = np.where(delta > 0, delta, 0.0)
    loss  = np.where(delta < 0, -delta, 0.0)
    avg_gain = np.convolve(gain, np.ones(14)/14, mode='same')
    avg_loss = np.convolve(loss, np.ones(14)/14, mode='same')
    rs  = np.where(avg_loss == 0, 100.0, avg_gain / (avg_loss + 1e-10))
    rsi = 100 - (100 / (1 + rs))

    # MACD (12, 26, 9)
    def ema(arr: np.ndarray, span: int) -> np.ndarray:
        k, result = 2 / (span + 1), arr.copy().astype(float)
        for i in range(1, len(result)):
            result[i] = arr[i] * k + result[i-1] * (1 - k)
        return result

    ema12  = ema(closes, 12)
    ema26  = ema(closes, 26)
    macd   = ema12 - ema26
    signal = ema(macd, 9)
    hist   = macd - signal

    return {
        "dates":  dates,
        "rsi":    [round(float(v), 2) for v in rsi],
        "macd":   [round(float(v), 2) for v in macd],
        "signal": [round(float(v), 2) for v in signal],
        "hist":   [round(float(v), 2) for v in hist],
    }
