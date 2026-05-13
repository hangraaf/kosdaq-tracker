"""투자 대가 조언 라우터."""
from __future__ import annotations

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi import APIRouter, HTTPException, Query

from kis_client import KISError
from kis_service import kis_available, live_chart
from stock_data import STOCK_MAP
from utils import generate_demo_ohlcv, seed_for

router = APIRouter(prefix="/guru", tags=["guru"])

GURUS = {
    "달리오": {
        "name": "레이 달리오",
        "eng": "Ray Dalio",
        "style": "리스크 패리티 · 부채 사이클",
        "icon": "⚖️",
        "color": "#2C6E49",
        "desc": "분산투자와 리스크 패리티로 모든 경제 환경에서 안정적 수익을 추구합니다.",
        "weights": {"stability": 0.4, "value": 0.2, "moat": 0.2, "momentum": 0.2},
    },
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
    "스미스": {
        "name": "테리 스미스",
        "eng": "Terry Smith",
        "style": "고품질 성장주 · Fundsmith",
        "icon": "🇬🇧",
        "color": "#8B4513",
        "desc": "높은 ROCE와 FCF를 가진 고품질 기업을 장기 보유합니다.",
        "weights": {"moat": 0.35, "growth": 0.3, "stability": 0.25, "value": 0.1},
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
    "코테가와": {
        "name": "코테가와 다카시",
        "eng": "Takashi Kotegawa (BNF)",
        "style": "모멘텀 · 단기 수급",
        "icon": "🇯🇵",
        "color": "#C0392B",
        "desc": "거래량과 수급을 분석해 강한 모멘텀 종목에 집중 투자합니다.",
        "weights": {"momentum": 0.5, "growth": 0.3, "stability": 0.1, "value": 0.1},
    },
    "카타야마": {
        "name": "카타야마 아키라",
        "eng": "Akira Katayama (五月天)",
        "style": "소형 성장주 · 집중투자",
        "icon": "🌸",
        "color": "#E91E8C",
        "desc": "미발굴 소형 KOSDAQ·도쿄 성장주에 집중해 초과 수익을 추구합니다.",
        "weights": {"growth": 0.45, "moat": 0.25, "momentum": 0.2, "stability": 0.1},
    },
}


# 대가별 PRISM 렌즈 — [trend, mom, vol, rsi, stab] 가중치
# 각 대가가 동일한 시장 데이터를 자신의 철학으로 해석하는 방식
_LENSES: dict[str, dict[str, list]] = {
    "달리오":   {"momentum": [0.2, 0.3, 0.3, 0.1, 0.1], "stability": [0.0, 0.0, 0.0, 0.4, 0.6], "growth": [0.3, 0.3, 0.3, 0.1, 0.0]},
    "버핏":     {"momentum": [0.5, 0.2, 0.1, 0.1, 0.1], "stability": [0.2, 0.0, 0.0, 0.3, 0.5], "growth": [0.5, 0.2, 0.1, 0.2, 0.0]},
    "린치":     {"momentum": [0.3, 0.4, 0.2, 0.1, 0.0], "stability": [0.1, 0.0, 0.0, 0.4, 0.5], "growth": [0.3, 0.3, 0.4, 0.0, 0.0]},
    "그레이엄": {"momentum": [0.4, 0.2, 0.1, 0.2, 0.1], "stability": [0.0, 0.0, 0.0, 0.2, 0.8], "growth": [0.5, 0.1, 0.0, 0.2, 0.2]},
    "스미스":   {"momentum": [0.4, 0.3, 0.1, 0.1, 0.1], "stability": [0.2, 0.0, 0.0, 0.3, 0.5], "growth": [0.4, 0.2, 0.3, 0.1, 0.0]},
    "오닐":     {"momentum": [0.3, 0.5, 0.2, 0.0, 0.0], "stability": [0.6, 0.3, 0.1, 0.0, 0.0], "growth": [0.2, 0.4, 0.4, 0.0, 0.0]},
    "코테가와": {"momentum": [0.2, 0.4, 0.4, 0.0, 0.0], "stability": [0.7, 0.2, 0.1, 0.0, 0.0], "growth": [0.1, 0.4, 0.5, 0.0, 0.0]},
    "카타야마": {"momentum": [0.2, 0.4, 0.3, 0.1, 0.0], "stability": [0.1, 0.0, 0.1, 0.4, 0.4], "growth": [0.3, 0.3, 0.4, 0.0, 0.0]},
}


def _compute_scores(code: str, df, guru_key: str) -> dict[str, float]:
    from utils import prism_components
    c = prism_components(df)
    comps = [c["trend"], c["mom"], c["vol"], c["rsi"], c["stab"]]
    lens = _LENSES[guru_key]

    # PRISM 렌즈 (0~1)
    mom_lens  = sum(w * v for w, v in zip(lens["momentum"],  comps))
    stab_lens = sum(w * v for w, v in zip(lens["stability"], comps))
    grow_lens = sum(w * v for w, v in zip(lens["growth"],    comps))

    # guru_key 기반 seed 오프셋 (20~79 범위) — 컴포넌트가 평탄해도 대가별 차이 보장
    sm_s = (seed_for(code, guru_key, "mom_s")  % 60 + 20) / 100
    ss_s = (seed_for(code, guru_key, "stab_s") % 60 + 20) / 100
    sg_s = (seed_for(code, guru_key, "grow_s") % 60 + 20) / 100

    # 렌즈 70% + seed 30% 혼합
    momentum  = round((mom_lens  * 0.7 + sm_s * 0.3) * 100, 1)
    stability = round((stab_lens * 0.7 + ss_s * 0.3) * 100, 1)
    growth    = round((grow_lens * 0.7 + sg_s * 0.3) * 100, 1)

    # 가치·해자: 가격 데이터로 산출 불가 → guru_key 포함 seed
    sv = seed_for(code, guru_key, "value")
    sm = seed_for(code, guru_key, "moat")
    per   = 1 - (sv % 30 + 5) / 35
    pbr   = 1 - ((sv >> 4) % 20 + 2) / 22
    value = round(((per + pbr) / 2) * 100, 1)
    moat  = round(min((sm % 80 + 20) / 100, 1) * 100, 1)

    return {"momentum": momentum, "stability": stability, "value": value, "growth": growth, "moat": moat}


def _build_reasons(code: str, stock_name: str, sector: str, market: str,
                   guru_key: str, scores: dict) -> list[str]:
    """대가별 상세 투자 근거 생성."""
    s = seed_for(code, guru_key)
    reasons: list[str] = []

    if guru_key == "달리오":
        debt = (s % 200) + 50
        div = round((seed_for(code, "div") % 40) / 10, 1)
        if debt < 100:
            reasons.append(f"부채비율 추정 {debt}% — 낮은 레버리지, 리스크 패리티 적합")
        elif debt < 150:
            reasons.append(f"부채비율 추정 {debt}% — 보통 수준, 분기별 모니터링 권장")
        else:
            reasons.append(f"부채비율 추정 {debt}% — 고레버리지, 부채 사이클 후기에 위험")
        if div > 2.0:
            reasons.append(f"배당수익률 추정 {div}% — 인플레이션 헤지 역할 가능")
        elif div > 1.0:
            reasons.append(f"배당수익률 추정 {div}% — 올웨더 관점에서 방어성 다소 부족")
        else:
            reasons.append("배당수익률 낮음 — 채권·금 병행 권장")
        if sector in {"금융", "자동차부품", "철강"}:
            reasons.append(f"{sector} 섹터 — 경기방어성 보유, 포트폴리오 안정 기여")
        elif sector in {"바이오", "게임", "엔터"}:
            reasons.append(f"{sector} 섹터 — 변동성 높음, 포트폴리오 비중 5% 이하 권장")

    elif guru_key == "버핏":
        pbr = round((s % 30) / 10 + 0.5, 1)
        roe = (s % 25) + 5
        if pbr < 1.0:
            reasons.append(f"PBR 추정 {pbr} — 청산가치 이하, 강한 안전마진 확보")
        elif pbr < 1.5:
            reasons.append(f"PBR 추정 {pbr} — 합리적 가치권, 해자 강도에 따라 결정")
        else:
            reasons.append(f"PBR 추정 {pbr} — 고평가 구간, 강한 해자 있어야 정당화 가능")
        if roe >= 15:
            reasons.append(f"ROE 추정 {roe}% — 탁월한 자본효율성, 장기 복리 성장 기대")
        elif roe >= 10:
            reasons.append(f"ROE 추정 {roe}% — 양호. 10년 지속 여부가 핵심")
        else:
            reasons.append(f"ROE 추정 {roe}% — 낮은 자본효율성. 경제적 해자 불명확")
        if sector in {"반도체", "금융", "자동차"}:
            reasons.append(f"{sector} — 기술·규모 해자 존재 가능성")
        elif sector in {"게임", "엔터", "바이오"}:
            reasons.append(f"{sector} — 사업 예측 어려움, 버핏 '능력 범위' 외 가능성")

    elif guru_key == "린치":
        growth = (seed_for(code, "lynch_growth") % 45) + 5
        pe = (seed_for(code, "lynch_pe") % 40) + 8
        debt = (seed_for(code, "lynch_debt") % 200) + 30
        peg = round(pe / max(growth, 1), 2)
        if peg < 0.75:
            reasons.append(f"PEG {peg:.2f} (PER 추정 {pe}) — 성장 대비 극히 저평가! 린치 최선호 구간")
        elif peg < 1.0:
            reasons.append(f"PEG {peg:.2f} (PER 추정 {pe}) — 성장 대비 적정 가격. 린치 기준 공정가치")
        else:
            reasons.append(f"PEG {peg:.2f} (PER 추정 {pe}) — 성장 대비 고평가. 린치는 비싼 성장주를 경계")
        if growth >= 25:
            reasons.append(f"성장률 추정 {growth}% — '패스트 그로어' 범주. 10루타 후보")
        elif growth >= 15:
            reasons.append(f"성장률 추정 {growth}% — '스토크 그로어' 수준")
        else:
            reasons.append(f"성장률 추정 {growth}% — 성장 정체. 린치 기준 매력 낮음")
        if debt < 60:
            reasons.append(f"부채비율 추정 {debt}% — 우량한 재무. 불황에도 생존 가능")
        else:
            reasons.append(f"부채비율 추정 {debt}% — 과도한 부채. 린치는 레버리지 성장 경계")
        if sector in {"인터넷", "게임", "엔터", "통신", "화장품", "식품"}:
            reasons.append(f"{sector} — 소비자 친숙 섹터. 린치 '아는 것에 투자' 원칙 부합")

    elif guru_key == "그레이엄":
        pe = (seed_for(code, "graham_pe") % 35) + 6
        pb = round((seed_for(code, "graham_pb") % 30 + 5) / 10, 1)
        div = round((seed_for(code, "graham_div") % 50) / 10, 1)
        if pe <= 10:
            reasons.append(f"PER 추정 {pe}배 — 극히 저평가. 그레이엄 '바겐 종목' 기준 충족")
        elif pe <= 15:
            reasons.append(f"PER 추정 {pe}배 — 합리적 가격. 그레이엄 방어적 투자 기준 내")
        else:
            reasons.append(f"PER 추정 {pe}배 — 고평가. 그레이엄은 높은 PER 종목을 투기로 간주")
        if pb <= 1.0:
            reasons.append(f"PBR 추정 {pb}배 — 장부가 이하! 그레이엄 안전마진 극대 구간")
        elif pb <= 1.5:
            reasons.append(f"PBR 추정 {pb}배 — 적정. PER×PBR={pe*pb:.0f} (≤22.5 규칙 확인)")
        else:
            reasons.append(f"PBR 추정 {pb}배 — 프리미엄 구간. 자산 대비 안전마진 부족")
        if div >= 3.0:
            reasons.append(f"배당수익률 추정 {div}% — 방어적 투자자 조건 충족")
        else:
            reasons.append(f"배당수익률 추정 {div}% — 그레이엄 방어적 기준에서 감점")

    elif guru_key == "스미스":
        roe = (seed_for(code, "ts_roe") % 38) + 5
        pe = (seed_for(code, "ts_pe") % 38) + 10
        debt = (seed_for(code, "ts_debt") % 180) + 15
        growth = (seed_for(code, "ts_growth") % 30) - 4
        fcf = (seed_for(code, "ts_fcf") % 35) + 60
        if roe >= 25:
            reasons.append(f"ROE 추정 {roe}% — 탁월한 자본 수익성. 스미스 기준 최우선 통과")
        elif roe >= 15:
            reasons.append(f"ROE 추정 {roe}% — 양호. Fundsmith 편입 가능 구간")
        else:
            reasons.append(f"ROE 추정 {roe}% — 낮음. 스미스: '평범한 기업에 투자하지 마라'")
        if fcf >= 90:
            reasons.append(f"FCF 전환율 추정 {fcf}% — 이익=현금. 스미스의 핵심 이익 품질 지표 최상")
        else:
            reasons.append(f"FCF 전환율 추정 {fcf}% — 현금 전환 부족. 이익 품질 점검 필요")
        if debt <= 50:
            reasons.append(f"부채비율 추정 {debt}% — 재무 건전. 스미스 '빚 없이 성장' 원칙 부합")
        else:
            reasons.append(f"부채비율 추정 {debt}% — 스미스는 레버리지 성장 기업을 경계")
        if growth >= 15:
            reasons.append(f"매출 성장률 추정 {growth}% — 강한 복리 성장. 스미스 장기 보유 요건 충족")
        elif growth >= 0:
            reasons.append(f"매출 성장률 추정 {growth}% — 완만한 성장. 가격결정력과 마진 방어력 확인 필요")
        else:
            reasons.append(f"매출 성장률 추정 {growth}% — 역성장. 스미스는 지속 성장 기업만 보유")
        if sector in {"인터넷", "IT서비스", "제약", "바이오", "화장품", "게임"}:
            reasons.append(f"{sector} — 스미스 선호 섹터. 반복 매출·진입 장벽·브랜드 가치 보유")
        elif sector in {"조선", "철강", "화학", "중공업", "에너지"}:
            reasons.append(f"{sector} — 스미스 기피 섹터. 경기 민감·자본집약적 산업")
        if pe <= 20:
            reasons.append(f"PER 추정 {pe}배 — 고품질 대비 합리적 가격. 스미스 이상적 매수 구간")
        elif pe <= 40:
            reasons.append(f"PER 추정 {pe}배 — 적정 프리미엄 구간. 품질 지속성 확인 후 보유")
        else:
            reasons.append(f"PER 추정 {pe}배 — 과도한 프리미엄. '과대지불하지 마라' — 스미스 3원칙")

    elif guru_key == "오닐":
        mom_pct = scores.get("momentum", 50)
        growth_s = scores.get("growth", 50)
        if mom_pct >= 70:
            reasons.append(f"모멘텀 점수 {mom_pct:.0f} — CANSLIM 기준 강한 상승 추세 확인")
        elif mom_pct >= 50:
            reasons.append(f"모멘텀 점수 {mom_pct:.0f} — 보통. 신고가 돌파 신호 대기 중")
        else:
            reasons.append(f"모멘텀 점수 {mom_pct:.0f} — 약한 모멘텀. 오닐: '절대 하락하는 칼날을 잡지 마라'")
        if growth_s >= 65:
            reasons.append("강한 이익 성장 확인 — CANSLIM의 C(현재 이익)·A(연간 이익) 조건 부합")
        if market == "KOSDAQ":
            reasons.append("KOSDAQ — 모멘텀 효과 강한 시장, 오닐 방식에 적합")

    elif guru_key == "코테가와":
        vol_spike = round((seed_for(code, "vol_spike") % 30) / 10 + 0.5, 1)
        mom_s = scores.get("momentum", 50)
        if mom_s >= 70:
            reasons.append(f"모멘텀 점수 {mom_s:.0f} — 강한 추세, BNF 트레일링 스톱 설정 권장")
        elif mom_s >= 50:
            reasons.append(f"모멘텀 점수 {mom_s:.0f} — 추세 유지, 방향성 확인 후 재판단")
        else:
            reasons.append(f"모멘텀 점수 {mom_s:.0f} — BNF 손절 기준 초과. 즉시 포지션 점검")
        if vol_spike >= 2.0:
            reasons.append(f"거래량 급증도 {vol_spike}x — 강한 수급 신호, 추세 신뢰도 높음")
        elif vol_spike >= 1.5:
            reasons.append(f"거래량 {vol_spike}x — 보통 수준, 추가 수급 확인 필요")
        else:
            reasons.append(f"거래량 {vol_spike}x — 수급 약함. 주가 움직임 신뢰도 낮음")
        if market == "KOSDAQ":
            reasons.append("KOSDAQ — 모멘텀 효과 강한 시장, BNF 방식에 적합")
        if sector in {"반도체", "2차전지", "바이오", "게임"}:
            reasons.append(f"{sector} — 테마 사이클 활성 섹터. 모멘텀 포착 기회")

    elif guru_key == "카타야마":
        growth_p = (seed_for(code, "growth") % 40) + 5
        margin_p = (seed_for(code, "margin") % 25) + 5
        mktcap_r = seed_for(code, "mktcap_rank") % 5
        if growth_p >= 30:
            reasons.append(f"매출 성장률 추정 {growth_p}% — 고성장 기업, 카타야마 핵심 조건 충족")
        elif growth_p >= 20:
            reasons.append(f"매출 성장률 추정 {growth_p}% — 양호한 성장. 지속성 확인 필요")
        else:
            reasons.append(f"매출 성장률 추정 {growth_p}% — 성장 정체. 카타야마 관점 매력 낮음")
        if margin_p >= 20:
            reasons.append(f"영업이익률 추정 {margin_p}% — 높은 마진, 해자와 가격결정력 반영")
        else:
            reasons.append(f"영업이익률 추정 {margin_p}% — 낮은 마진. 수익성 개선 로드맵 필수")
        if market == "KOSDAQ" and mktcap_r <= 1:
            reasons.append("소형 KOSDAQ — 기관 미발굴 가능성 높음. 카타야마 최선호 구간")
        elif market == "KOSDAQ":
            reasons.append("KOSDAQ 중소형 — 성장 잠재력과 유동성의 균형점")
        else:
            reasons.append("KOSPI 대형주 — 기관 커버리지 포화, 초과수익 기회 제한적")
        if sector in {"바이오", "반도체", "소프트웨어", "의료기기"}:
            reasons.append(f"{sector} — 카타야마 선호 고성장 섹터")

    return reasons


def _guru_verdict(guru_key: str, scores: dict, stock_name: str,
                  sector: str, market: str, code: str) -> dict:
    guru = GURUS[guru_key]
    weights = guru["weights"]

    total = sum(scores.get(k, 50) * w for k, w in weights.items())
    total = round(total, 1)

    if total >= 70:
        rating, action, color = "★★★★★", "강력 매수", "#B5453F"
    elif total >= 58:
        rating, action, color = "★★★★", "매수", "#B0883A"
    elif total >= 45:
        rating, action, color = "★★★", "관망", "#436B95"
    elif total >= 32:
        rating, action, color = "★★", "주의", "#6B8AAE"
    else:
        rating, action, color = "★", "회피", "#7C7264"

    comments = {
        "달리오": {
            "강력 매수": f"{stock_name}은 리스크 패리티 포트폴리오의 핵심 자산이 될 수 있습니다. 낮은 레버리지와 안정적 현금흐름이 돋보입니다.",
            "매수": f"{stock_name}은 올웨더 포트폴리오에 편입할 만한 자산입니다. 비중을 점진적으로 늘리세요.",
            "관망": f"{stock_name}은 현재 분산 포트폴리오 내 비중 확대보다 유지 수준이 적절합니다.",
            "주의": f"{stock_name}의 부채 구조가 우려됩니다. 부채 사이클 후기엔 레버리지 기업이 가장 먼저 타격받습니다.",
            "회피": f"분산투자의 관점에서도 {stock_name}은 리스크 대비 수익이 불충분합니다.",
        },
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
        "스미스": {
            "강력 매수": f"{stock_name}은 Fundsmith 편입 최상위 후보입니다. 탁월한 ROE와 FCF 품질이 확인됩니다.",
            "매수": f"{stock_name}은 고품질 성장주 기준을 충족합니다. 장기 보유 포트폴리오에 편입하세요.",
            "관망": f"{stock_name}은 품질은 좋으나 가격이 부담됩니다. 더 매력적인 진입점을 기다리겠습니다.",
            "주의": f"{stock_name}은 스미스의 품질 기준을 일부 충족하지 못합니다. 비중을 낮게 유지하세요.",
            "회피": f"{stock_name}은 Fundsmith 편입 기준 미달입니다. 더 좋은 품질의 기업을 찾겠습니다.",
        },
        "오닐": {
            "강력 매수": f"{stock_name}! CANSLIM 모든 기준 충족. 신고가 돌파 시 즉시 매수입니다.",
            "매수": f"{stock_name}은 강한 모멘텀을 보이고 있습니다. 손절선을 명확히 하고 진입하세요.",
            "관망": f"{stock_name}의 모멘텀이 약합니다. 명확한 돌파 신호를 기다리겠습니다.",
            "주의": f"{stock_name}은 하락 추세입니다. 절대 하락하는 칼날을 잡지 마세요.",
            "회피": f"{stock_name}은 모든 기술적 기준에서 실패했습니다. 다음 기회를 노리겠습니다.",
        },
        "코테가와": {
            "강력 매수": f"{stock_name}! 강한 수급과 모멘텀이 확인됩니다. BNF 방식으로 즉시 진입, 트레일링 스톱 필수.",
            "매수": f"{stock_name}은 추세가 살아있습니다. 손절선(-5%)을 명확히 하고 진입하세요.",
            "관망": f"{stock_name}의 수급과 모멘텀이 불분명합니다. 방향성이 확인될 때까지 대기.",
            "주의": f"{stock_name}은 손절 기준을 이미 초과했습니다. BNF 원칙상 즉시 청산 검토.",
            "회피": f"{stock_name}은 모든 수급·모멘텀 기준에서 실패했습니다. 다음 종목을 찾겠습니다.",
        },
        "카타야마": {
            "강력 매수": f"{stock_name}은 카타야마가 찾던 소형 고성장주의 전형입니다. 집중 투자 검토.",
            "매수": f"{stock_name}은 성장 스토리가 뚜렷합니다. 성장이 지속되는 한 보유를 유지하세요.",
            "관망": f"{stock_name}의 성장 모멘텀을 더 확인해야 합니다. 실적 발표 후 재판단.",
            "주의": f"{stock_name}의 성장 스토리가 훼손될 가능성이 있습니다. 즉시 재점검하세요.",
            "회피": f"{stock_name}은 카타야마의 소형 성장주 발굴 기준에 미달합니다.",
        },
    }

    comment = comments.get(guru_key, {}).get(action, f"{stock_name}에 대한 투자 의견입니다.")
    reasons = _build_reasons(code, stock_name, sector, market, guru_key, scores)

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
        "reasons": reasons,
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

    scores = _compute_scores(code, df, guru)
    verdict = _guru_verdict(guru, scores, stock.name, stock.sector, stock.market, code)
    verdict["stock_name"] = stock.name
    verdict["stock_code"] = code
    verdict["sector"] = stock.sector
    return verdict
