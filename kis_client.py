"""Small Korea Investment & Securities Open API client for quotes/charts."""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

import pandas as pd
import requests


class KISError(RuntimeError):
    """Raised when the KIS API returns an error or an invalid payload."""


@dataclass(frozen=True)
class KISConfig:
    app_key: str
    app_secret: str
    env: str = "prod"

    @property
    def base_url(self) -> str:
        if self.env in {"vps", "paper", "mock"}:
            return "https://openapivts.koreainvestment.com:29443"
        return "https://openapi.koreainvestment.com:9443"


class KISClient:
    def __init__(self, config: KISConfig, token_file: Path | None = None) -> None:
        self.config = config
        self.token_file = token_file

    def _read_cached_token(self) -> dict[str, Any] | None:
        if not self.token_file or not self.token_file.exists():
            return None
        try:
            payload = json.loads(self.token_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        expires_at = float(payload.get("expires_at", 0))
        if payload.get("access_token") and expires_at > time.time() + 300:
            return payload
        return None

    def _write_cached_token(self, token: str, expires_in: int) -> None:
        if not self.token_file:
            return
        self.token_file.parent.mkdir(exist_ok=True)
        payload = {"access_token": token, "expires_at": time.time() + max(expires_in - 60, 60)}
        self.token_file.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def access_token(self) -> str:
        cached = self._read_cached_token()
        if cached:
            return str(cached["access_token"])

        response = requests.post(
            f"{self.config.base_url}/oauth2/tokenP",
            headers={"content-type": "application/json; charset=utf-8"},
            json={
                "grant_type": "client_credentials",
                "appkey": self.config.app_key,
                "appsecret": self.config.app_secret,
            },
            timeout=10,
        )
        data = self._parse_response(response)
        token = data.get("access_token")
        if not token:
            raise KISError(f"access_token missing from KIS response: {data}")
        self._write_cached_token(str(token), int(data.get("expires_in", 86400)))
        return str(token)

    def _headers(self, tr_id: str) -> dict[str, str]:
        return {
            "authorization": f"Bearer {self.access_token()}",
            "appkey": self.config.app_key,
            "appsecret": self.config.app_secret,
            "tr_id": tr_id,
            "custtype": "P",
        }

    @staticmethod
    def _parse_response(response: requests.Response) -> dict[str, Any]:
        try:
            data = response.json()
        except ValueError as exc:
            raise KISError(f"KIS returned non-JSON response: HTTP {response.status_code}") from exc
        if response.status_code >= 400:
            raise KISError(f"KIS HTTP {response.status_code}: {data}")
        if data.get("rt_cd") not in {None, "0"}:
            message = data.get("msg1") or data.get("msg_cd") or data
            raise KISError(f"KIS API error: {message}")
        return data

    @staticmethod
    def _to_int(value: Any, default: int = 0) -> int:
        try:
            return int(float(str(value).replace(",", "").strip()))
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _to_float(value: Any, default: float = 0.0) -> float:
        try:
            return float(str(value).replace(",", "").strip())
        except (TypeError, ValueError):
            return default

    def inquire_price(self, code: str) -> dict[str, Any]:
        response = requests.get(
            f"{self.config.base_url}/uapi/domestic-stock/v1/quotations/inquire-price",
            headers=self._headers("FHKST01010100"),
            params={
                "FID_COND_MRKT_DIV_CODE": "J",
                "FID_INPUT_ISCD": code,
            },
            timeout=10,
        )
        output = self._parse_response(response).get("output") or {}
        price = self._to_int(output.get("stck_prpr"))
        change = self._to_int(output.get("prdy_vrss"))
        change_rate = self._to_float(output.get("prdy_ctrt"))
        return {
            "price": price,
            "change": change,
            "change_rate": change_rate,
            "volume": self._to_int(output.get("acml_vol")),
            "market_cap": self._to_int(output.get("hts_avls")) * 100_000_000,
            "raw": output,
        }

    def lookup_stock_info(self, code: str) -> dict[str, Any] | None:
        """Try to resolve an unknown stock code via KIS.

        Attempts KOSPI first, then KOSDAQ.  Returns a dict with keys
        ``name``, ``market`` (KOSPI/KOSDAQ), ``sector``, ``price`` on success,
        or ``None`` when the code is not found on either exchange.
        """
        for mrkt_div, market_label in (("J", "KOSPI"), ("Q", "KOSDAQ")):
            try:
                response = requests.get(
                    f"{self.config.base_url}/uapi/domestic-stock/v1/quotations/inquire-price",
                    headers=self._headers("FHKST01010100"),
                    params={
                        "FID_COND_MRKT_DIV_CODE": mrkt_div,
                        "FID_INPUT_ISCD": code,
                    },
                    timeout=10,
                )
                output = self._parse_response(response).get("output") or {}
                name = str(output.get("hts_kor_isnm", "")).strip()
                price = self._to_int(output.get("stck_prpr"))
                if not name or price == 0:
                    continue
                sector = str(output.get("bstp_kor_isnm", "기타")).strip() or "기타"
                return {
                    "name": name,
                    "market": market_label,
                    "sector": sector,
                    "price": price,
                }
            except KISError:
                continue
        return None

    def daily_chart(self, code: str, days: int) -> pd.DataFrame:
        end = date.today()
        start = end - pd.Timedelta(days=max(days * 2, 60))
        response = requests.get(
            f"{self.config.base_url}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice",
            headers=self._headers("FHKST03010100"),
            params={
                "FID_COND_MRKT_DIV_CODE": "J",
                "FID_INPUT_ISCD": code,
                "FID_INPUT_DATE_1": start.strftime("%Y%m%d"),
                "FID_INPUT_DATE_2": end.strftime("%Y%m%d"),
                "FID_PERIOD_DIV_CODE": "D",
                "FID_ORG_ADJ_PRC": "1",
            },
            timeout=10,
        )
        rows = self._parse_response(response).get("output2") or []
        if not rows:
            raise KISError("KIS daily chart response did not include output2 rows.")

        frame = pd.DataFrame(
            [
                {
                    "date": pd.to_datetime(row.get("stck_bsop_date"), format="%Y%m%d", errors="coerce"),
                    "open": self._to_int(row.get("stck_oprc")),
                    "high": self._to_int(row.get("stck_hgpr")),
                    "low": self._to_int(row.get("stck_lwpr")),
                    "close": self._to_int(row.get("stck_clpr")),
                    "volume": self._to_int(row.get("acml_vol")),
                }
                for row in rows
            ]
        )
        frame = frame.dropna(subset=["date"]).sort_values("date").tail(days).reset_index(drop=True)
        if frame.empty:
            raise KISError("KIS daily chart rows could not be parsed.")
        return frame


def config_from_env() -> KISConfig | None:
    app_key = os.getenv("KIS_APP_KEY", "").strip()
    app_secret = os.getenv("KIS_APP_SECRET", "").strip()
    if not app_key or not app_secret:
        return None
    return KISConfig(app_key=app_key, app_secret=app_secret, env=os.getenv("KIS_ENV", "prod").strip() or "prod")
