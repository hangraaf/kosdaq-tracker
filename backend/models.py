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
    # username 필드는 이메일을 그대로 받는다 (소문자 정규화는 라우터에서). 일부 이메일이 길 수 있어 max_length=120.
    username: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=6)
    display: str = Field(default="", max_length=40)
    email: str = ""
    marketing_opt_in: bool = False


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
    marketing_opt_in: bool = False
    created_at: float = 0
    provider: str = ""


class UserProfileUpdate(BaseModel):
    display: str | None = Field(default=None, max_length=40)
    marketing_opt_in: bool | None = None


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


# ── Company Profile ───────────────────────────────────────────────────────

class CompanyOverview(BaseModel):
    """회사 개요 — DART 기업개황 기반 (현재는 MockDart)."""
    name: str
    ceo: str = ""
    established: str = ""       # YYYY.MM.DD
    industry: str = ""          # 업종 상세
    homepage: str = ""
    summary: str = ""           # 사업 요약 (3~5문장)
    source: str = "MOCK"        # "DART" | "MOCK"


class DividendInfo(BaseModel):
    """배당 정보 — DART 배당사항 기반 (현재는 MockDart)."""
    yield_pct: float = 0.0      # 시가배당률 %
    per_share: int = 0          # 주당 배당금 (원)
    fiscal_year: str = ""       # 기준 사업연도
    payout_ratio: float = 0.0   # 배당성향 %
    source: str = "MOCK"


class InvestorFlowDay(BaseModel):
    date: str
    foreign: int = 0            # 외국인 순매수 거래대금 (억원)
    institution: int = 0        # 기관
    individual: int = 0         # 개인


class InvestorFlow(BaseModel):
    """투자자별 수급 — 최근 N일 누적 + 일별 시계열."""
    days: int = 20
    foreign_sum: int = 0        # 누적 (억원)
    institution_sum: int = 0
    individual_sum: int = 0
    foreign_ratio: float = 0.0  # 외국인 지분율 % (KIS inquire-price.hts_frgn_ehrt)
    series: list[InvestorFlowDay] = []
    source: str = "DEMO"        # "KIS" | "DEMO"


class StockProfile(BaseModel):
    code: str
    name: str
    overview: CompanyOverview
    dividend: DividendInfo
    investor_flow: InvestorFlow


# ── News Sentiment ────────────────────────────────────────────────────────

class SentimentHeadline(BaseModel):
    title: str
    link: str


class NewsSentiment(BaseModel):
    code: str
    score: float                 # -1.0 ~ +1.0
    label: str                   # "긍정" | "중립" | "부정" | "데이터 없음"
    summary: str                 # 초보자 친화 한 줄 요약
    source: str                  # "LLM" | "KEYWORD" | "EMPTY"
    news_count: int = 0
    headlines: list[SentimentHeadline] = []
