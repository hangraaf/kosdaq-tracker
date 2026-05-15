"""종목별 뉴스 센티먼트 분석.

레이어:
1. 뉴스 수집 — Google News RSS (회사명 검색)
2. 센티먼트 분석
   - Anthropic 키 있음 → Claude Haiku 4.5로 LLM 분석
   - Anthropic 키 없음 → 키워드 기반 단순 점수 (fallback)
3. 결과 — score(-1~+1) + label(긍정/중립/부정) + 초보자 친화 한 줄 요약

설계 원칙: 사용자가 데이터 소스를 한눈에 알 수 있도록 `source: "LLM" | "KEYWORD" | "EMPTY"` 명시.
"""
from __future__ import annotations

import re
import urllib.parse
import xml.etree.ElementTree as ET
from typing import Any

import requests

from config import settings


# ── 1. 뉴스 수집 ──────────────────────────────────────────────────────────

_GNEWS_BASE = "https://news.google.com/rss/search"


def fetch_company_news(company_name: str, limit: int = 8) -> list[dict[str, str]]:
    """회사명으로 Google News RSS 검색 → 최신 뉴스 N개 반환."""
    query = urllib.parse.quote(f"{company_name} 주식")
    url = f"{_GNEWS_BASE}?q={query}&hl=ko&gl=KR&ceid=KR:ko"
    try:
        resp = requests.get(
            url,
            timeout=8,
            headers={"User-Agent": "Mozilla/5.0 (compatible; NewsBot/1.0)"},
        )
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
    except Exception:
        return []

    items: list[dict[str, str]] = []
    for item in root.findall(".//item")[:limit]:
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub = (item.findtext("pubDate") or "").strip()
        desc_raw = (item.findtext("description") or "").strip()
        desc = re.sub(r"<[^>]+>", "", desc_raw)[:200].strip()
        if not title:
            continue
        items.append({"title": title, "link": link, "pub": pub, "desc": desc})
    return items


# ── 2-A. 키워드 기반 fallback ─────────────────────────────────────────────

_POSITIVE_KWS = [
    "상승", "급등", "사상최고", "신고가", "호재", "흑자", "성장", "수주", "계약체결",
    "신제품", "신기술", "특허", "수출증가", "실적호조", "어닝서프라이즈", "목표가상향",
    "배당확대", "자사주매입", "투자유치", "신사업", "수익성개선", "확장", "선정",
]
_NEGATIVE_KWS = [
    "하락", "급락", "신저가", "악재", "적자", "감소", "부진", "리콜", "소송", "벌금",
    "조사", "압수수색", "실적악화", "어닝쇼크", "목표가하향", "감자", "유상증자",
    "워크아웃", "법정관리", "상폐", "거래정지", "구조조정", "감원", "철수",
]


def keyword_sentiment(items: list[dict[str, str]]) -> dict[str, Any]:
    """뉴스 제목·요약에서 긍정/부정 키워드 카운트 → 단순 점수."""
    if not items:
        return {
            "score": 0.0,
            "label": "데이터 없음",
            "summary": "최근 관련 뉴스가 수집되지 않았습니다.",
            "source": "EMPTY",
            "news_count": 0,
        }

    pos = neg = 0
    for it in items:
        text = (it.get("title", "") + " " + it.get("desc", ""))
        for kw in _POSITIVE_KWS:
            if kw in text:
                pos += 1
        for kw in _NEGATIVE_KWS:
            if kw in text:
                neg += 1

    total = pos + neg
    if total == 0:
        score = 0.0
        label = "중립"
        summary = f"최근 뉴스 {len(items)}건에서 뚜렷한 호재·악재 키워드가 발견되지 않았습니다."
    else:
        score = round((pos - neg) / total, 2)
        if score >= 0.4:
            label = "긍정"
            summary = f"최근 뉴스 {len(items)}건 중 긍정 키워드({pos})가 부정({neg})보다 우세합니다."
        elif score <= -0.4:
            label = "부정"
            summary = f"최근 뉴스 {len(items)}건 중 부정 키워드({neg})가 긍정({pos})보다 우세합니다."
        else:
            label = "중립"
            summary = f"최근 뉴스 {len(items)}건 — 호재·악재 키워드가 혼재합니다(긍정 {pos} / 부정 {neg})."

    return {
        "score": score,
        "label": label,
        "summary": summary,
        "source": "KEYWORD",
        "news_count": len(items),
    }


# ── 2-B. LLM 분석 ─────────────────────────────────────────────────────────

_LLM_SYSTEM = (
    "당신은 한국 주식 뉴스를 분석해 초보 투자자에게 설명하는 어시스턴트입니다. "
    "주어진 종목의 최근 뉴스 헤드라인을 읽고, 종합 센티먼트를 JSON으로만 응답하세요. "
    "전문 용어를 피하고 누구나 이해할 수 있는 한국어로 작성합니다.\n\n"
    "응답 스키마(엄격):\n"
    "{\n"
    '  "score": <float, -1.0 ~ 1.0>,  // -1=매우 부정, 0=중립, 1=매우 긍정\n'
    '  "label": <"긍정"|"중립"|"부정">,\n'
    '  "summary": <string, 한국어 2~3문장, 80자 이내, 초보자도 이해 가능한 평이한 표현>\n'
    "}\n"
    "JSON 외 다른 텍스트는 절대 포함하지 마세요."
)


def llm_sentiment(company_name: str, items: list[dict[str, str]]) -> dict[str, Any] | None:
    """Claude Haiku 4.5로 뉴스 센티먼트 분석. 키 미설정·실패 시 None 반환."""
    key = settings.anthropic_api_key.strip()
    if not key or not items:
        return None

    try:
        import anthropic
    except ImportError:
        return None

    headlines = "\n".join(f"- {it['title']}" for it in items[:8])
    user_msg = f"종목: {company_name}\n\n최근 뉴스 헤드라인:\n{headlines}"

    try:
        client = anthropic.Anthropic(api_key=key)
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=400,
            system=[{"type": "text", "text": _LLM_SYSTEM, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user_msg}],
        )
        text = resp.content[0].text if resp.content else ""
    except Exception as exc:
        print(f"[sentiment] LLM 호출 실패: {type(exc).__name__}: {exc}", flush=True)
        return None

    # JSON 파싱 (앞뒤 코드펜스 제거)
    import json
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.MULTILINE).strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        print(f"[sentiment] LLM JSON 파싱 실패: {cleaned[:200]}", flush=True)
        return None

    score = float(data.get("score", 0.0))
    score = max(-1.0, min(1.0, score))
    label = str(data.get("label") or "중립")
    summary = str(data.get("summary") or "").strip() or "분석 결과가 비어있습니다."

    return {
        "score": round(score, 2),
        "label": label,
        "summary": summary,
        "source": "LLM",
        "news_count": len(items),
    }


# ── 3. 통합 진입점 ────────────────────────────────────────────────────────

def analyze_sentiment(code: str, company_name: str) -> dict[str, Any]:
    """LLM 우선, 실패 시 키워드 fallback."""
    news = fetch_company_news(company_name, limit=8)

    result = llm_sentiment(company_name, news)
    if result is None:
        result = keyword_sentiment(news)

    # 상위 3건 뉴스 헤드라인을 함께 반환 (UI에서 표시 가능)
    result["headlines"] = [
        {"title": it["title"], "link": it["link"]} for it in news[:3]
    ]
    result["code"] = code
    return result
