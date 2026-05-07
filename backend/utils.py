"""공유 유틸리티 함수."""
from __future__ import annotations

import hashlib
from datetime import date

import numpy as np
import pandas as pd


def seed_for(*args: str) -> int:
    h = hashlib.md5("|".join(args).encode()).hexdigest()
    return int(h[:8], 16)


def generate_demo_ohlcv(code: str, base_price: int, days: int) -> pd.DataFrame:
    rng = np.random.default_rng(seed_for(code, str(days)))
    dates = pd.bdate_range(end=date.today(), periods=days)
    drift = rng.normal(0.00035, 0.0002)
    volatility = rng.uniform(0.018, 0.035)
    returns = rng.normal(drift, volatility, len(dates))
    if base_price <= 0:
        base_price = int((seed_for(code, "base") % 90) + 10) * 1000
    close = base_price * np.exp(np.cumsum(returns))
    open_ = close * (1 + rng.normal(0, 0.007, len(dates)))
    high = np.maximum(open_, close) * (1 + rng.uniform(0.002, 0.022, len(dates)))
    low = np.minimum(open_, close) * (1 - rng.uniform(0.002, 0.022, len(dates)))
    volume = rng.integers(80_000, 2_800_000, len(dates))
    return pd.DataFrame({
        "date": [d.strftime("%Y-%m-%d") for d in dates],
        "open": open_.round().astype(int).tolist(),
        "high": high.round().astype(int).tolist(),
        "low": low.round().astype(int).tolist(),
        "close": close.round().astype(int).tolist(),
        "volume": volume.tolist(),
    })


def stock_demo_snapshot(code: str, name: str, market: str, sector: str, base_price: int) -> dict:
    df = generate_demo_ohlcv(code, base_price, 90)
    last = df.iloc[-1]
    prev = df.iloc[-2]
    change = int(last["close"]) - int(prev["close"])
    change_rate = change / int(prev["close"]) * 100
    market_cap = int(last["close"]) * (seed_for(code, "shares") % 80_000_000 + 20_000_000)
    return {
        "code": code, "name": name, "market": market, "sector": sector,
        "price": int(last["close"]), "change": change,
        "change_rate": round(change_rate, 2),
        "volume": int(last["volume"]), "market_cap": market_cap,
    }


def calculate_prism_score(code: str, df: pd.DataFrame) -> float:
    """PRISM™ — Predictive Resonance Index for Stock Momentum (0~100)."""
    if df is None or len(df) < 20:
        return float(seed_for(code, "prism") % 60 + 20)

    close = df["close"].astype(float).values
    volume = df["volume"].astype(float).values

    # 1. 추세 (MA20 대비 현재 위치)
    ma20 = close[-20:].mean()
    trend = min(max((close[-1] / ma20 - 1) * 5 + 0.5, 0), 1)

    # 2. 모멘텀 (최근 5일 수익률)
    mom = min(max((close[-1] / close[-6] - 1) * 10 + 0.5, 0), 1) if len(close) >= 6 else 0.5

    # 3. 거래량 (최근 5일 vs 이전 20일)
    vol_recent = volume[-5:].mean() if len(volume) >= 5 else volume.mean()
    vol_base = volume[-25:-5].mean() if len(volume) >= 25 else volume.mean()
    vol_score = min(vol_recent / (vol_base + 1e-9), 3) / 3

    # 4. RSI
    delta = np.diff(close)
    gain = np.where(delta > 0, delta, 0)[-14:].mean()
    loss = np.where(delta < 0, -delta, 0)[-14:].mean()
    rsi = 100 - (100 / (1 + gain / (loss + 1e-9))) if loss > 0 else 50
    rsi_score = 1 - abs(rsi - 55) / 55

    # 5. 변동성 (낮을수록 높은 점수 — 안정적 상승 선호)
    vol_std = close[-20:].std() / (close[-20:].mean() + 1e-9)
    stab = max(1 - vol_std * 10, 0)

    raw = (trend * 0.3 + mom * 0.25 + vol_score * 0.2 + rsi_score * 0.15 + stab * 0.1)
    return round(raw * 100, 1)
