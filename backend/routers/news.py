"""증시 영향 뉴스 — 국내외 RSS 집계 + 키워드 필터링 + 글로벌 한국어 번역."""
from __future__ import annotations

import email.utils
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import requests
from fastapi import APIRouter

# ── 번역 ──────────────────────────────────────────────────────────────────

def _translate_ko(text: str) -> str:
    if not text:
        return text
    try:
        from deep_translator import GoogleTranslator
        return GoogleTranslator(source="auto", target="ko").translate(text[:500]) or text
    except Exception:
        return text  # 실패 시 원문 유지

router = APIRouter(prefix="/news", tags=["news"])

# ── RSS 소스 ───────────────────────────────────────────────────────────────

FEEDS: list[dict[str, str]] = [
    # 한국
    {"url": "https://www.yna.co.kr/rss/economy.xml",       "region": "KR", "source": "연합뉴스"},
    {"url": "https://www.mk.co.kr/rss/40300001/",          "region": "KR", "source": "매일경제"},
    {"url": "https://www.hankyung.com/feed/economy",        "region": "KR", "source": "한국경제"},
    {"url": "https://www.edaily.co.kr/rss/finance.xml",    "region": "KR", "source": "이데일리"},
    # 글로벌
    {"url": "https://feeds.reuters.com/reuters/businessNews",                    "region": "GLOBAL", "source": "Reuters"},
    {"url": "https://finance.yahoo.com/news/rssindex",                           "region": "GLOBAL", "source": "Yahoo Finance"},
    {"url": "https://search.cnbc.com/rs/search/combinedcsvfeed.xml?partnerId=wrss01&id=100003114",
                                                                                 "region": "GLOBAL", "source": "CNBC"},
]

# 증시 연관 키워드 (제목 기준 필터)
KR_KEYWORDS = [
    "금리", "환율", "코스피", "코스닥", "증시", "주식", "반도체", "삼성",
    "물가", "경기", "GDP", "CPI", "연준", "달러", "유가", "채권", "수출",
    "무역", "기준금리", "통화", "주가", "매출", "실적", "상승", "하락",
    "투자", "펀드", "시가총액", "외국인", "기관",
]
GLOBAL_KEYWORDS = [
    "rate", "inflation", "Fed", "GDP", "recession", "earnings", "stock",
    "market", "economy", "trade", "tariff", "interest", "yield", "nasdaq",
    "S&P", "dow", "crude", "oil", "dollar", "treasury", "debt", "growth",
    "china", "semiconductor", "chip", "AI", "tech",
]

# ── 메모리 캐시 (15분) ────────────────────────────────────────────────────

_cache: dict[str, Any] = {"ts": 0.0, "items": []}
NEWS_CACHE_TTL = 900  # 15분


# ── RSS 파싱 ──────────────────────────────────────────────────────────────

def _parse_rss(feed: dict) -> list[dict]:
    url, region, source = feed["url"], feed["region"], feed["source"]
    try:
        resp = requests.get(
            url, timeout=8,
            headers={"User-Agent": "Mozilla/5.0 (compatible; NewsBot/1.0)"},
        )
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
    except Exception:
        return []

    items = []
    for item in root.findall(".//item"):
        title = (item.findtext("title") or "").strip()
        link  = (item.findtext("link")  or "").strip()
        desc  = (item.findtext("description") or "").strip()
        pub   = (item.findtext("pubDate") or "").strip()

        if not title or not link:
            continue

        ts = 0.0
        if pub:
            try:
                ts = email.utils.parsedate_to_datetime(pub).timestamp()
            except Exception:
                pass

        # 키워드 관련도 점수
        text = (title + " " + desc).lower()
        kws = KR_KEYWORDS if region == "KR" else GLOBAL_KEYWORDS
        score = sum(1 for kw in kws if kw.lower() in text)
        if score == 0:
            continue  # 관련 없는 기사 제외

        # HTML 태그 제거
        import re
        desc_clean = re.sub(r"<[^>]+>", "", desc)[:200].strip()

        items.append({
            "title":   title,
            "link":    link,
            "desc":    desc_clean,
            "source":  source,
            "region":  region,
            "ts":      ts,
            "score":   score,
        })

    return items


def _fetch_all() -> list[dict]:
    results: list[dict] = []
    with ThreadPoolExecutor(max_workers=len(FEEDS)) as ex:
        futures = {ex.submit(_parse_rss, f): f for f in FEEDS}
        for fut in as_completed(futures):
            try:
                results.extend(fut.result())
            except Exception:
                pass

    # 중복 제거 (제목 첫 30자 기준)
    seen: set[str] = set()
    unique: list[dict] = []
    for item in results:
        key = item["title"][:30].lower()
        if key not in seen:
            seen.add(key)
            unique.append(item)

    # 최신순 + 관련도 복합 정렬
    now = time.time()
    unique.sort(key=lambda x: x["score"] * 2 + (1 if now - x["ts"] < 3600 else 0), reverse=True)

    # 글로벌 뉴스 제목·설명 한국어 번역 (병렬)
    global_items = [i for i in unique if i["region"] == "GLOBAL"]
    if global_items:
        with ThreadPoolExecutor(max_workers=8) as ex:
            title_futs = {ex.submit(_translate_ko, i["title"]): i for i in global_items}
            desc_futs  = {ex.submit(_translate_ko, i["desc"]):  i for i in global_items}
            for fut, item in title_futs.items():
                translated = fut.result()
                item["title_orig"] = item["title"]
                item["title"] = translated
            for fut, item in desc_futs.items():
                item["desc"] = fut.result()

    return unique


# ── 엔드포인트 ────────────────────────────────────────────────────────────

@router.get("/")
def get_news(limit: int = 40, region: str = "ALL"):
    now = time.time()
    if now - _cache["ts"] > NEWS_CACHE_TTL or not _cache["items"]:
        _cache["items"] = _fetch_all()
        _cache["ts"] = now

    items = _cache["items"]
    if region != "ALL":
        items = [i for i in items if i["region"] == region]

    # ts → ISO 문자열 변환
    from datetime import datetime, timezone
    out = []
    for item in items[:limit]:
        out.append({**item, "published": datetime.fromtimestamp(item["ts"], tz=timezone.utc).isoformat() if item["ts"] else ""})
    return {"items": out, "cached_at": datetime.fromtimestamp(_cache["ts"], tz=timezone.utc).isoformat()}


@router.post("/refresh")
def refresh_news():
    """캐시 강제 갱신."""
    _cache["ts"] = 0.0
    return {"ok": True}
