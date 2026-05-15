"""PRISM™ 로보어드바이저 라우터 — 프리미엄 전용."""
from __future__ import annotations

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from typing import Annotated
from fastapi import APIRouter, Depends

from kis_client import KISError
from kis_service import kis_available, live_chart
from models import RoboPortfolioItem, RoboResult, RoboSurveyAnswer, BacktestResult, BacktestPoint
from routers.auth import get_premium_user
from stock_data import MARKET_STOCKS, STOCK_MAP
from utils import calculate_prism_score, generate_demo_ohlcv, seed_for

router = APIRouter(prefix="/robo", tags=["robo"])

ROBO_SURVEY = [
    {"id": "q_goal", "q": "투자 목표를 선택해 주세요.",
     "opts": ["원금 보전이 최우선", "안정적 이자 이상 수익", "성장·수익 균형 추구", "공격적 자산 증식", "최대 수익 (손실 감내)"],
     "w": [1, 2, 3, 4, 5]},
    {"id": "q_horizon", "q": "투자 기간은 얼마나 생각하시나요?",
     "opts": ["6개월 미만", "6개월~1년", "1~3년", "3~5년", "5년 이상"],
     "w": [1, 2, 3, 4, 5]},
    {"id": "q_loss", "q": "투자금의 몇 %까지 손실을 감내할 수 있나요?",
     "opts": ["5% 미만", "5~10%", "10~20%", "20~30%", "30% 이상"],
     "w": [1, 2, 3, 4, 5]},
    {"id": "q_exp", "q": "주식 투자 경험은 어느 정도인가요?",
     "opts": ["없음", "1년 미만", "1~3년", "3~7년", "7년 이상"],
     "w": [1, 2, 3, 4, 5]},
    {"id": "q_panic", "q": "보유 종목이 20% 하락 시 어떻게 하시겠나요?",
     "opts": ["즉시 전량 매도", "절반 이상 매도", "관망", "일부 추가 매수", "공격적 추가 매수"],
     "w": [1, 2, 3, 4, 5]},
]

ROBO_PROFILES = {
    1: {"name": "보수형", "eng": "CONSERVATIVE", "icon": "🛡",
        "desc": "원금 보전 최우선. 낮은 변동성과 안정적 배당 종목 위주로 포트폴리오를 구성합니다.",
        "tag": "안정·배당 우선", "color": "#436B95", "bg": "#D6E4F0", "fg": "#0D2A4A",
        "sectors": ["금융", "통신", "보험", "식품", "에너지", "유통", "음료"], "min_prism": 30},
    2: {"name": "안정형", "eng": "STABLE", "icon": "⚓",
        "desc": "우량 대형주 중심 분산 투자. 꾸준한 수익과 낮은 변동성을 목표합니다.",
        "tag": "대형주·분산 투자", "color": "#5C7FA8", "bg": "#C8D8EC", "fg": "#0D2A4A",
        "sectors": ["금융", "통신", "자동차", "화학", "식품", "유통", "보험", "철강"], "min_prism": 38},
    3: {"name": "균형형", "eng": "BALANCED", "icon": "⚖",
        "desc": "성장성과 안정성을 균형 있게 추구. PRISM™ 점수 상위 다양한 섹터를 균등 배분합니다.",
        "tag": "섹터 균형 포트폴리오", "color": "#B0883A", "bg": "#F0E0B0", "fg": "#4A2E00",
        "sectors": ["반도체", "자동차", "금융", "화학", "바이오", "건설", "IT서비스", "제약"], "min_prism": 44},
    4: {"name": "성장형", "eng": "GROWTH", "icon": "🚀",
        "desc": "중장기 성장 섹터 집중 투자. 변동성을 감수하고 높은 수익을 목표합니다.",
        "tag": "성장 섹터 집중", "color": "#B5453F", "bg": "#F0C8B0", "fg": "#4A0A00",
        "sectors": ["반도체", "2차전지", "바이오", "IT서비스", "인터넷", "로보틱스", "AI·소프트웨어", "반도체장비"], "min_prism": 50},
    5: {"name": "공격형", "eng": "AGGRESSIVE", "icon": "⚡",
        "desc": "PRISM™ 최고 점수 종목만 선별. 최대 리스크를 감수하며 최대 수익을 추구합니다.",
        "tag": "고수익·고위험", "color": "#8B1A1A", "bg": "#F0B0B0", "fg": "#3A0000",
        "sectors": ["반도체", "2차전지소재", "바이오", "로보틱스", "AI·소프트웨어", "의료기기", "반도체장비", "게임"], "min_prism": 56},
}


def _profile_id_from_score(total: int) -> int:
    if total <= 8:
        return 1
    if total <= 12:
        return 2
    if total <= 16:
        return 3
    if total <= 20:
        return 4
    return 5


def _build_portfolio(profile_id: int) -> list[dict]:
    profile = ROBO_PROFILES[profile_id]
    sectors = profile["sectors"]
    min_prism = profile["min_prism"]
    all_stocks = MARKET_STOCKS["전체"]
    pool = [s for s in all_stocks if any(sec in s.sector for sec in sectors)]

    scored = []
    for stock in pool:
        try:
            df = live_chart(stock.code, 60) if kis_available() else generate_demo_ohlcv(stock.code, stock.base_price, 60)
        except KISError:
            df = generate_demo_ohlcv(stock.code, stock.base_price, 60)
        score = calculate_prism_score(stock.code, df)
        if score >= min_prism:
            scored.append((stock, score))

    if len(scored) < 5:
        for s in pool:
            try:
                df = live_chart(s.code, 60) if kis_available() else generate_demo_ohlcv(s.code, s.base_price, 60)
            except KISError:
                df = generate_demo_ohlcv(s.code, s.base_price, 60)
            scored.append((s, calculate_prism_score(s.code, df)))

    scored.sort(key=lambda x: -x[1])

    # 섹터 당 최대 2개, 총 10종목
    selected = []
    sector_count: dict[str, int] = {}
    for stock, score in scored:
        if len(selected) >= 10:
            break
        cnt = sector_count.get(stock.sector, 0)
        if cnt >= 2:
            continue
        sector_count[stock.sector] = cnt + 1
        selected.append((stock, score))

    if not selected:
        selected = scored[:10]

    total_score = sum(s for _, s in selected)
    items = []
    for stock, score in selected:
        weight = round(score / total_score * 100, 1) if total_score > 0 else 10.0
        seed = seed_for(stock.code, "reason")
        reasons = [
            f"PRISM™ {score:.1f}점 — {stock.sector} 섹터 상위",
            f"6개월 기술적 모멘텀 {'+' if score > 50 else ''}{score - 50:.1f}",
            f"섹터 내 수익성 상위 {seed % 20 + 1}%",
        ]
        items.append({
            "code": stock.code, "name": stock.name, "sector": stock.sector,
            "prism_score": score, "weight": weight,
            "reason": reasons[seed % len(reasons)],
        })
    return items


def _normalize_df_dates(df: "pd.DataFrame") -> "pd.DataFrame":
    """date 컬럼을 'YYYY-MM-DD' 문자열로 통일 (Timestamp·문자열 모두 처리)."""
    import pandas as pd
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.strftime("%Y-%m-%d")
    return df.dropna(subset=["date"])


def _run_backtest(items: list[RoboPortfolioItem]) -> BacktestResult:
    import pandas as pd
    DAYS = 60  # _build_portfolio와 동일하게 맞춰 SQLite 캐시 재사용
    if not items:
        print("[backtest] items 비어있음 → ok=False", flush=True)
        return BacktestResult(ok=False, total_return=0.0, series=[], days=0, error="items 비어있음")

    total_w = sum(i.weight for i in items)
    if total_w <= 0:
        return BacktestResult(ok=False, total_return=0.0, series=[], days=0, error=f"total_weight={total_w}")
    weights = [i.weight / total_w for i in items]

    use_live = kis_available()
    frames: list[pd.DataFrame] = []
    last_kis_error: str | None = None

    # Phase 1: KIS 시도. 한 종목이라도 실패하면 전체 demo로 전환 (날짜 일관성 보장)
    if use_live:
        for item in items:
            try:
                df = live_chart(item.code, DAYS)
                frames.append(_normalize_df_dates(df))
            except Exception as exc:
                last_kis_error = f"{item.code}: {type(exc).__name__}: {exc}"
                print(f"[backtest] KIS 실패 ({last_kis_error}) — demo 전체 전환", flush=True)
                frames = []
                use_live = False
                break

    # Phase 2: demo fallback (KIS 불가능 또는 일부 실패 시)
    if not use_live:
        for item in items:
            base = STOCK_MAP.get(item.code)
            base_price = base.base_price if base else 50000
            df = generate_demo_ohlcv(item.code, base_price, DAYS)
            frames.append(_normalize_df_dates(df))

    print(f"[backtest] items={len(items)}, use_live={use_live}, frames={len(frames)}", flush=True)

    if not frames:
        return BacktestResult(ok=False, total_return=0.0, series=[], days=0, error="frames 비어있음")

    date_sets = [set(df["date"]) for df in frames]
    common_dates = sorted(date_sets[0].intersection(*date_sets[1:]))
    print(f"[backtest] common_dates={len(common_dates)}", flush=True)

    if len(common_dates) < 5:
        return BacktestResult(
            ok=False, total_return=0.0, series=[], days=0,
            error=f"common_dates={len(common_dates)} (frames={len(frames)}, use_live={use_live}, last_kis_error={last_kis_error})"
        )

    returns_matrix: list[list[float]] = []
    for df in frames:
        df_f = df[df["date"].isin(common_dates)].sort_values("date").reset_index(drop=True)
        closes = df_f["close"].astype(float).tolist()
        daily = [0.0] + [(closes[i] / closes[i - 1]) - 1 for i in range(1, len(closes))]
        returns_matrix.append(daily)

    n = len(common_dates)
    value = 100.0
    series = [BacktestPoint(date=common_dates[0], value=100.0)]
    for day in range(1, n):
        ret = sum(weights[i] * returns_matrix[i][day] for i in range(len(items)))
        value *= (1 + ret)
        series.append(BacktestPoint(date=common_dates[day], value=round(value, 4)))

    total_return = round(value - 100.0, 2)
    print(f"[backtest] ok=True, days={len(common_dates)}, return={total_return}", flush=True)
    return BacktestResult(
        total_return=total_return,
        series=series,
        days=len(common_dates),
        ok=True,
    )


@router.get("/survey")
def get_survey():
    return ROBO_SURVEY


@router.post("/recommend", response_model=RoboResult)
def recommend(
    answers: RoboSurveyAnswer,
    _user: Annotated[dict, Depends(get_premium_user)],
):
    weights = [1, 2, 3, 4, 5]
    total = (
        weights[answers.q_goal] + weights[answers.q_horizon] +
        weights[answers.q_loss] + weights[answers.q_exp] + weights[answers.q_panic]
    )
    pid = _profile_id_from_score(total)
    profile = ROBO_PROFILES[pid]
    items_raw = _build_portfolio(pid)
    items = [RoboPortfolioItem(**i) for i in items_raw]
    avg_prism = sum(i.prism_score for i in items) / len(items) if items else 0

    backtest: BacktestResult | None = None
    try:
        backtest = _run_backtest(items)  # ok=False여도 진단용으로 그대로 반환
    except Exception as exc:
        print(f"[backtest] unhandled: {type(exc).__name__}: {exc}", flush=True)
        backtest = BacktestResult(
            ok=False, total_return=0.0, series=[], days=0,
            error=f"unhandled: {type(exc).__name__}: {exc}",
        )

    return RoboResult(
        profile_id=pid,
        profile_name=profile["name"],
        profile_eng=profile["eng"],
        profile_desc=profile["desc"],
        tag=profile["tag"],
        color=profile["color"],
        bg=profile["bg"],
        fg=profile["fg"],
        items=items,
        score_total=round(avg_prism, 1),
        backtest=backtest,
    )
