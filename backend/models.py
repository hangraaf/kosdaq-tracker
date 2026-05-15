from __future__ import annotations

from dataclasses import dataclass
from pydantic import BaseModel, Field


# ── 종목 데이터 ───────────────────────────────────────────────────────────

@dataclass(frozen=True)
class Stock:
    code: str
    name: str
    market: str
    sector: str
    base_price: int


# ── Auth ─────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=30)
    password: str = Field(min_length=6)
    display: str = ""
    email: str = ""


class UserLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    display: str
    plan: str


class UserProfile(BaseModel):
    username: str
    display: str
    plan: str
    email: str


# ── Portfolio ─────────────────────────────────────────────────────────────

class PortfolioEntry(BaseModel):
    code: str
    name: str
    market: str
    sector: str
    shares: int
    avg_price: float


class PortfolioAdd(BaseModel):
    code: str
    shares: int = Field(gt=0)
    avg_price: float = Field(gt=0)


# ── Robo Advisor ──────────────────────────────────────────────────────────

class RoboSurveyAnswer(BaseModel):
    q_goal: int = Field(ge=0, le=4)
    q_horizon: int = Field(ge=0, le=4)
    q_loss: int = Field(ge=0, le=4)
    q_exp: int = Field(ge=0, le=4)
    q_panic: int = Field(ge=0, le=4)


class RoboPortfolioItem(BaseModel):
    code: str
    name: str
    sector: str
    prism_score: float
    weight: float
    reason: str


class BacktestPoint(BaseModel):
    date: str
    value: float
    upper: float | None = None
    lower: float | None = None
    drawdown: float | None = None


class BacktestResult(BaseModel):
    total_return: float
    series: list[BacktestPoint]
    days: int = 90
    ok: bool = True
    error: str | None = None
    # 신뢰성 메타데이터
    data_source: str = "DEMO"           # "KIS" | "DEMO"
    realtime: bool = False              # KIS=실시간, DEMO=모의
    fee_rate: float = 0.0015            # 0.15% 매수+매도 합산 가정
    tax_rate: float = 0.0023            # 매도 시 거래세 0.23%
    rebalance: str = "기간 내 보유(rebalance 없음)"
    max_drawdown: float = 0.0           # MDD (음수, %)
    annualized_volatility: float = 0.0  # 연환산 변동성 %
    sharpe: float | None = None
    period_start: str | None = None
    period_end: str | None = None
    band_pct: float = 0.0               # ±1σ 밴드 폭 %


class RoboResult(BaseModel):
    profile_id: int
    profile_name: str
    profile_eng: str
    profile_desc: str
    tag: str
    color: str
    bg: str
    fg: str
    items: list[RoboPortfolioItem]
    score_total: float
    backtest: BacktestResult | None = None


# ── Chart / Snapshot ──────────────────────────────────────────────────────

class OHLCVRow(BaseModel):
    date: str
    open: int
    high: int
    low: int
    close: int
    volume: int


class StockSnapshot(BaseModel):
    code: str
    name: str
    market: str
    sector: str
    price: int
    change: int
    change_rate: float
    volume: int
    market_cap: int
