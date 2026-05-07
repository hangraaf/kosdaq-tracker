"""투자 대가 조언 라우터."""
from __future__ import annotations

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import numpy as np
from fastapi import APIRouter, HTTPException, Query

from kis_client import KISError
from kis_service import kis_available, live_chart
from stock_data import STOCK_MAP
from utils import generate_demo_ohlcv, seed_for

router = APIRouter(prefix="/guru", tags=["guru"])

GURUS = {
    "버핏": {
        "name": "워런 버핏",
        "eng": "Warren Buffett",
        "style": "가치투자 · 장기보유",
        "icon": "🎩",
        "color": "#436B95",
        "desc": "내재 가치 대비 저평가된 우량 기업에 집중합니다.",
        "weights": {"value": 0.4, "moat": 0.3, "stability": 0.2, "momentum": 0.1},
    },
    "린치": {
        "name": "피터 린치",
        "eng": "Peter Lynch",
        "style": "성장주 발굴 · GARP",
        "icon": "🔍",
        "color": "#B0883A",
        "desc": "합리적 가격의 성장주를 발굴합니다. PEG 비율을 중시합니다.",
        "weights": {"growth": 0.4, "value": 0.2, "momentum": 0.3, "stability": 0.1},
    },
    "그레이엄": {
        "name": "벤저민 그레이엄",
        "eng": "Benjamin Graham",
        "style": "안전마진 · 깊은 가치",
        "icon": "📐",
        "color": "#5C7FA8",
        "desc": "철저한 안전마진을 요구합니다. PBR 1 이하, 저PER 종목 선호.",
        "weights": {"value": 0.5, "stability": 0.3, "moat": 0.1, "momentum": 0.1},
    },
    "오닐": {
        "name": "윌리엄 오닐",
        "eng": "William O'Neil",
        "style": "CANSLIM · 모멘텀",
        "icon": "⚡",
        "color": "#B5453F",
        "desc": "강한 이익 성장 + 신고가 돌파 패턴을 추구합니다.",
        "weights": {"momentum": 0.4, "growth": 0.3, "value": 0.1, "stability": 0.2},
    },
    "템플턴": {
        "name": "존 템플턴",
        "eng": "John Templeton",
        "style": "역발상 · 글로벌",
        "icon": "🌏",
        "color": "#7C5C9A",
        "desc": "극도의 비관론이 팽배할 때 저평가 우량주를 매수합니다.",
        "weights": {"value": 0.35, "stability": 0.25, "moat": 0.25, "momentum": 0.15},
    },
}


def _compute_scores(code: str, df) -> dict[str, float]:
    """종목 점수를 4개 차원으로 계산."""
    closes = df["close"].astype(float).values
    volumes = df["volume"].astype(float).values
    seed = seed_for(code, "guru")

    # 모멘텀: 최근 20일 수익률
    mom = float((closes[-1] / closes[-20] - 1) * 100) if len(closes) >= 20 else 0.0
    momentum = min(max((mom + 20) / 40, 0), 1)

    # 변동성 (낮을수록 안정)
    std = float(np.std(closes[-20:]) / np.mean(closes[-20:])) if len(closes) >= 20 else 0.1
    stability = max(1 - std * 5, 0)

    # 가치 (seed 기반 PER/PBR 추정)
    per = (seed % 30 + 5) / 35       # 낮을수록 좋음
    pbr = ((seed >> 4) % 20 + 2) / 22
    value = (per + pbr) / 2

    # 성장 (거래량 증가 + 모멘텀)
    vol_growth = float(np.mean(volumes[-5:]) / (np.mean(volumes[-20:]) + 1e-9)) if len(volumes) >= 20 else 1.0
    growth = min(max((vol_growth - 0.5) / 2, 0), 1) * 0.5 + momentum * 0.5

    # 해자 (시가총액 추정 기반 - 큰 기업일수록 높음)
    cap_score = min((seed % 80 + 20) / 100, 1)
    moat = cap_score

    return {
        "momentum": round(momentum * 100, 1),
        "stability": round(stability * 100, 1),
        "value": round(value * 100, 1),
        "growth": round(growth * 100, 1),
        "moat": round(moat * 100, 1),
    }


def _guru_verdict(guru_key: str, scores: dict, stock_name: str) -> dict:
    guru = GURUS[guru_key]
    weights = guru["weights"]

    total = sum(scores.get(k, 50) * w for k, w in weights.items())
    total = round(total, 1)

    if total >= 70:
        rating, action = "★★★★★", "강력 매수"
        color = "#B5453F"
    elif total >= 58:
        rating, action = "★★★★", "매수"
        color = "#B0883A"
    elif total >= 45:
        rating, action = "★★★", "관망"
        color = "#436B95"
    elif total >= 32:
        rating, action = "★★", "주의"
        color = "#6B8AAE"
    else:
        rating, action = "★", "회피"
        color = "#7C7264"

    comments = {
        "버핏": {
            "강력 매수": f"{stock_name}은 내가 평생 보유하고 싶은 기업입니다. 탁월한 해자와 합리적 가격이 돋보입니다.",
            "매수": f"{stock_name}은 좋은 기업이지만, 조금 더 기다려 더 나은 가격에 매수하는 것도 고려해보세요.",
            "관망": f"{stock_name}은 아직 내 안전마진 기준을 충족하지 못했습니다. 인내심을 갖고 기다리겠습니다.",
            "주의": f"{stock_name}의 내재 가치 산정이 쉽지 않습니다. 이해하기 어려운 기업엔 투자하지 않습니다.",
            "회피": f"저는 {stock_name}에 투자하지 않겠습니다. 안전마진이 전혀 없어 보입니다.",
        },
        "린치": {
            "강력 매수": f"{stock_name}! 바로 10루타 후보입니다. 성장률 대비 가격이 매우 매력적입니다.",
            "매수": f"{stock_name}은 좋은 성장주입니다. PEG 비율이 합리적 수준에 있습니다.",
            "관망": f"{stock_name}은 아직 성장 스토리가 명확하지 않습니다. 조금 더 지켜보겠습니다.",
            "주의": f"{stock_name}의 성장 모멘텀이 둔화되고 있습니다. 비중을 줄일 시기입니다.",
            "회피": f"{stock_name}은 성장도 가치도 매력적이지 않습니다. 다른 종목을 찾겠습니다.",
        },
        "그레이엄": {
            "강력 매수": f"{stock_name}은 충분한 안전마진을 제공합니다. 자산 대비 현저히 저평가되어 있습니다.",
            "매수": f"{stock_name}은 그레이엄 기준을 대부분 충족합니다. 분산 매수를 권장합니다.",
            "관망": f"{stock_name}은 완전 가치 수준입니다. 안전마진이 충분하지 않아 관망하겠습니다.",
            "주의": f"{stock_name}의 재무 안전성에 의문이 있습니다. 재무제표를 꼼꼼히 확인하세요.",
            "회피": f"{stock_name}은 그레이엄 기준에 전혀 부합하지 않습니다.",
        },
        "오닐": {
            "강력 매수": f"{stock_name}! CANSLIM 모든 기준 충족. 신고가 돌파 시 즉시 매수입니다.",
            "매수": f"{stock_name}은 강한 모멘텀을 보이고 있습니다. 손절선을 명확히 하고 진입하세요.",
            "관망": f"{stock_name}의 모멘텀이 약합니다. 명확한 돌파 신호를 기다리겠습니다.",
            "주의": f"{stock_name}은 하락 추세입니다. 절대 하락하는 칼날을 잡지 마세요.",
            "회피": f"{stock_name}은 모든 기술적 기준에서 실패했습니다. 다음 기회를 노리겠습니다.",
        },
        "템플턴": {
            "강력 매수": f"극도의 비관론 속에서 {stock_name}은 역발상 매수의 최적 후보입니다.",
            "매수": f"{stock_name}은 시장이 과도하게 저평가한 우량 종목으로 보입니다.",
            "관망": f"{stock_name}에 아직 충분한 공포가 형성되지 않았습니다. 더 기다리겠습니다.",
            "주의": f"{stock_name}의 하락이 일시적인지 구조적인지 판단이 어렵습니다.",
            "회피": f"비관론이 있더라도 {stock_name}의 펀더멘털이 너무 취약합니다.",
        },
    }

    comment = comments.get(guru_key, {}).get(action, f"{stock_name}에 대한 투자 의견입니다.")

    return {
        "guru": guru_key,
        "guru_name": guru["name"],
        "guru_eng": guru["eng"],
        "style": guru["style"],
        "icon": guru["icon"],
        "color": guru["color"],
        "rating": rating,
        "action": action,
        "action_color": color,
        "score": total,
        "comment": comment,
        "scores": scores,
        "desc": guru["desc"],
    }


@router.get("/list")
def list_gurus():
    return [{"key": k, "name": v["name"], "eng": v["eng"],
             "style": v["style"], "icon": v["icon"], "color": v["color"],
             "desc": v["desc"]} for k, v in GURUS.items()]


@router.get("/{code}")
def analyze(code: str, guru: str = Query("버핏")):
    stock = STOCK_MAP.get(code)
    if not stock:
        raise HTTPException(404, detail=f"종목 코드 {code}를 찾을 수 없습니다.")
    if guru not in GURUS:
        raise HTTPException(400, detail=f"지원하지 않는 대가입니다. 선택 가능: {list(GURUS.keys())}")

    if kis_available():
        try:
            df = live_chart(code, 60)
        except KISError:
            df = generate_demo_ohlcv(code, stock.base_price, 60)
    else:
        df = generate_demo_ohlcv(code, stock.base_price, 60)

    scores = _compute_scores(code, df)
    verdict = _guru_verdict(guru, scores, stock.name)
    verdict["stock_name"] = stock.name
    verdict["stock_code"] = code
    verdict["sector"] = stock.sector
    return verdict
