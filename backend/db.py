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
PROFILE_TTL       = 86_400   # 24시간 (회사개요·배당·수급)
SENTIMENT_TTL     = 21_600   # 6시간 (뉴스 센티먼트)


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
        con.execute("""
            CREATE TABLE IF NOT EXISTS profile_cache (
                code       TEXT PRIMARY KEY,
                data_json  TEXT,
                updated_at REAL DEFAULT 0
            )
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS sentiment_cache (
                code       TEXT PRIMARY KEY,
                data_json  TEXT,
                updated_at REAL DEFAULT 0
            )
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS users (
                username             TEXT PRIMARY KEY,
                pwd_hash             TEXT DEFAULT '',
                display              TEXT DEFAULT '',
                email                TEXT DEFAULT '',
                email_verified       INTEGER DEFAULT 0,
                plan                 TEXT DEFAULT 'free',
                provider             TEXT DEFAULT '',
                provider_user_id     TEXT DEFAULT '',
                marketing_opt_in     INTEGER DEFAULT 0,
                marketing_opt_in_at  REAL DEFAULT 0,
                created_at           REAL DEFAULT 0
            )
        """)
        con.execute("""
            CREATE INDEX IF NOT EXISTS idx_users_provider
            ON users(provider, provider_user_id)
        """)
        con.execute("""
            CREATE INDEX IF NOT EXISTS idx_users_email
            ON users(email)
        """)
    _migrate_users_from_json()


# ── 사용자 ─────────────────────────────────────────────────────────────────

def _migrate_users_from_json() -> None:
    """기존 users.json 데이터를 SQLite로 1회 이전. 이전 후 .bak로 보존."""
    users_json = DATA_DIR / "users.json"
    if not users_json.exists():
        return
    with _conn() as con:
        existing = con.execute("SELECT COUNT(*) AS c FROM users").fetchone()
        if existing and existing["c"] > 0:
            return
    try:
        data = json.loads(users_json.read_text(encoding="utf-8"))
    except Exception:
        return
    if not isinstance(data, dict) or not data:
        return
    now = time.time()
    with _conn() as con:
        for uname, rec in data.items():
            if not isinstance(rec, dict):
                continue
            con.execute("""
                INSERT OR IGNORE INTO users
                (username, pwd_hash, display, email, plan, provider, created_at)
                VALUES (?, ?, ?, ?, ?, '', ?)
            """, (
                uname,
                rec.get("pwd_hash", ""),
                rec.get("display", uname),
                rec.get("email", ""),
                rec.get("plan", "free"),
                now,
            ))
    backup = users_json.with_suffix(".json.bak")
    try:
        users_json.rename(backup)
        print(f"[STARTUP] users.json → SQLite 이전 완료 ({len(data)}명), 원본은 {backup.name}로 보존")
    except Exception:
        pass


def users_get(username: str) -> dict | None:
    with _conn() as con:
        row = con.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    return dict(row) if row else None


def users_get_by_provider(provider: str, provider_user_id: str) -> dict | None:
    with _conn() as con:
        row = con.execute(
            "SELECT * FROM users WHERE provider = ? AND provider_user_id = ?",
            (provider, provider_user_id),
        ).fetchone()
    return dict(row) if row else None


def users_create(
    *,
    username: str,
    pwd_hash: str = "",
    display: str = "",
    email: str = "",
    email_verified: bool = False,
    plan: str = "free",
    provider: str = "",
    provider_user_id: str = "",
    marketing_opt_in: bool = False,
) -> None:
    now = time.time()
    with _conn() as con:
        con.execute("""
            INSERT INTO users
            (username, pwd_hash, display, email, email_verified, plan,
             provider, provider_user_id, marketing_opt_in, marketing_opt_in_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            username,
            pwd_hash,
            display or username,
            email,
            1 if email_verified else 0,
            plan,
            provider,
            provider_user_id,
            1 if marketing_opt_in else 0,
            now if marketing_opt_in else 0,
            now,
        ))


def users_update(username: str, **fields) -> None:
    if not fields:
        return
    allowed = {
        "pwd_hash", "display", "email", "email_verified", "plan",
        "provider", "provider_user_id", "marketing_opt_in", "marketing_opt_in_at",
    }
    sets = []
    vals = []
    for k, v in fields.items():
        if k not in allowed:
            continue
        if k in ("email_verified", "marketing_opt_in"):
            v = 1 if v else 0
        sets.append(f"{k} = ?")
        vals.append(v)
    if not sets:
        return
    vals.append(username)
    with _conn() as con:
        con.execute(f"UPDATE users SET {', '.join(sets)} WHERE username = ?", vals)


def users_set_marketing_opt_in(username: str, opt_in: bool) -> None:
    users_update(
        username,
        marketing_opt_in=opt_in,
        marketing_opt_in_at=time.time() if opt_in else 0,
    )


def users_list_all() -> list[dict]:
    """관리자용 — 전체 사용자 목록 (비밀번호 해시 제외)."""
    with _conn() as con:
        rows = con.execute(
            "SELECT username, display, email, plan, provider, marketing_opt_in, created_at FROM users ORDER BY created_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


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


# ── 프로필 캐시 (회사개요·배당·수급) ─────────────────────────────────────

def get_profile(code: str) -> dict | None:
    with _conn() as con:
        row = con.execute(
            "SELECT * FROM profile_cache WHERE code = ?", (code,)
        ).fetchone()
    if not row:
        return None
    if time.time() - row["updated_at"] > PROFILE_TTL:
        return None
    return json.loads(row["data_json"])


def set_profile(code: str, data: dict) -> None:
    with _conn() as con:
        con.execute("""
            INSERT INTO profile_cache (code, data_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(code) DO UPDATE SET
                data_json=excluded.data_json, updated_at=excluded.updated_at
        """, (code, json.dumps(data, default=str), time.time()))


# ── 센티먼트 캐시 ─────────────────────────────────────────────────────────

def get_sentiment(code: str) -> dict | None:
    with _conn() as con:
        row = con.execute(
            "SELECT * FROM sentiment_cache WHERE code = ?", (code,)
        ).fetchone()
    if not row:
        return None
    if time.time() - row["updated_at"] > SENTIMENT_TTL:
        return None
    return json.loads(row["data_json"])


def set_sentiment(code: str, data: dict) -> None:
    with _conn() as con:
        con.execute("""
            INSERT INTO sentiment_cache (code, data_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(code) DO UPDATE SET
                data_json=excluded.data_json, updated_at=excluded.updated_at
        """, (code, json.dumps(data, default=str), time.time()))
