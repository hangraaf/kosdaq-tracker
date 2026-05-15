"""DART OpenAPI 커넥터 — 추상 인터페이스 + Mock 구현.

DART API 키 발급 전까지는 MockDartClient가 샘플 데이터로 응답한다.
키 발급 후에는 LiveDartClient를 추가하고 get_dart_client()에서 분기만 바꾸면 된다.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Protocol

from config import BASE_DIR, settings
from models import CompanyOverview, DividendInfo


class DartClient(Protocol):
    """DART 커넥터 인터페이스."""

    def company_overview(self, code: str, name: str) -> CompanyOverview: ...
    def dividend(self, code: str) -> DividendInfo: ...


MOCK_DIR = BASE_DIR / "data" / "dart_mock"


def _load_mock_db() -> dict:
    path = MOCK_DIR / "companies.json"
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


class MockDartClient:
    """샘플 JSON 기반 Mock — DART 키 발급 전 임시 구현."""

    def __init__(self) -> None:
        self._db = _load_mock_db()

    def company_overview(self, code: str, name: str) -> CompanyOverview:
        row = self._db.get(code) or {}
        ov = row.get("overview") or {}
        return CompanyOverview(
            name=ov.get("name") or name,
            ceo=ov.get("ceo", ""),
            established=ov.get("established", ""),
            industry=ov.get("industry", ""),
            homepage=ov.get("homepage", ""),
            summary=ov.get("summary") or _fallback_summary(name),
            source="MOCK",
        )

    def dividend(self, code: str) -> DividendInfo:
        row = self._db.get(code) or {}
        dv = row.get("dividend") or {}
        return DividendInfo(
            yield_pct=float(dv.get("yield_pct", 0.0)),
            per_share=int(dv.get("per_share", 0)),
            fiscal_year=dv.get("fiscal_year", ""),
            payout_ratio=float(dv.get("payout_ratio", 0.0)),
            source="MOCK",
        )


def _fallback_summary(name: str) -> str:
    return (
        f"{name}은(는) 한국 증시 상장사입니다. "
        "회사 개요 상세 정보는 DART OpenAPI 키 발급 후 제공됩니다."
    )


_client: DartClient | None = None


def get_dart_client() -> DartClient:
    """싱글톤 — DART 키가 있으면 Live, 없으면 Mock."""
    global _client
    if _client is not None:
        return _client

    dart_key = getattr(settings, "dart_api_key", "").strip()
    if dart_key:
        # TODO(DART): LiveDartClient(dart_key) 로 교체
        _client = MockDartClient()
    else:
        _client = MockDartClient()
    return _client
