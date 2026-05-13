"""SQLite 기반 주가·차트 영구 캐시."""
from __future__ import annotations

import json
import sqlite3
import time
from contextlib import contextmanager

from config import DATA_DIR

DB_PATH = DATA_DIR / "cache.db"

# 장중(KST 09:00~15:30 평일) TTL
PRICE_TTL_MARKET  = 60       # 1분
PRICE_TTL_OFFHOUR = 14_400   # 4시간
CHART_TTL         = 3_600    # 1시간


def _is_market_hour() -> bool:
    from datetime import datetime, timezone, timedelta
    kst = timezone(timedelta(hours=9))
    now = datetime.now(kst)
    if now.weekday() >= 5:
        return False
    t = now.hour * 100 + now.minute
    return 900 <= t <= 1530


def price_ttl() -> int:
    return PRICE_TTL_MARKET if _is_market_hour() else PRICE_TTL_OFFHOUR


@contextmanager
def _conn():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    finally:
        con.close()


def init_db() -> None:
    with _conn() as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS price_cache (
                code         TEXT PRIMARY KEY,
                price        INTEGER DEFAULT 0,
                change       INTEGER DEFAULT 0,
                change_rate  REAL    DEFAULT 0.0,
                volume       INTEGER DEFAULT 0,
                market_cap   INTEGER DEFAULT 0,
                updated_at   REAL    DEFAULT 0
            )
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS chart_cache (
                cache_key  TEXT PRIMARY KEY,
                data_json  TEXT,
                updated_at REAL DEFAULT 0
            )
        """)


# ── 주가 캐시 ──────────────────────────────────────────────────────────────

def get_price(code: str) -> dict | None:
    ttl = price_ttl()
    with _conn() as con:
        row = con.execute("SELECT * FROM price_cache WHERE code = ?", (code,)).fetchone()
    if not row:
        return None
    if time.time() - row["updated_at"] > ttl:
        return None
    return {k: row[k] for k in row.keys() if k != "updated_at"}


def set_price(code: str, data: dict) -> None:
    with _conn() as con:
        con.execute("""
            INSERT INTO price_cache (code, price, change, change_rate, volume, market_cap, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(code) DO UPDATE SET
                price=excluded.price, change=excluded.change,
                change_rate=excluded.change_rate, volume=excluded.volume,
                market_cap=excluded.market_cap, updated_at=excluded.updated_at
        """, (
            code,
            data.get("price", 0),
            data.get("change", 0),
            data.get("change_rate", 0.0),
            data.get("volume", 0),
            data.get("market_cap", 0),
            time.time(),
        ))


def get_prices_bulk(codes: list[str]) -> dict[str, dict]:
    """여러 종목 일괄 조회 (캐시 히트된 것만 반환)."""
    if not codes:
        return {}
    ttl = price_ttl()
    now = time.time()
    placeholders = ",".join("?" * len(codes))
    with _conn() as con:
        rows = con.execute(
            f"SELECT * FROM price_cache WHERE code IN ({placeholders})", codes
        ).fetchall()
    result: dict[str, dict] = {}
    for row in rows:
        if now - row["updated_at"] <= ttl:
            result[row["code"]] = {k: row[k] for k in row.keys() if k != "updated_at"}
    return result


# ── 차트 캐시 ──────────────────────────────────────────────────────────────

def get_chart(cache_key: str) -> list | None:
    with _conn() as con:
        row = con.execute(
            "SELECT * FROM chart_cache WHERE cache_key = ?", (cache_key,)
        ).fetchone()
    if not row:
        return None
    if time.time() - row["updated_at"] > CHART_TTL:
        return None
    return json.loads(row["data_json"])


def set_chart(cache_key: str, data: list) -> None:
    with _conn() as con:
        con.execute("""
            INSERT INTO chart_cache (cache_key, data_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(cache_key) DO UPDATE SET
                data_json=excluded.data_json, updated_at=excluded.updated_at
        """, (cache_key, json.dumps(data, default=str), time.time()))
