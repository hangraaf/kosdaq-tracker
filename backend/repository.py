"""저장소 추상화 레이어 — JSON 파일(현행) / PostgreSQL(선택) 자동 전환.

환경변수 DATABASE_URL이 없으면 기존 JSON 파일 방식을 그대로 사용합니다.
DATABASE_URL이 있으면 PostgreSQL을 사용합니다.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Protocol, runtime_checkable

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from config import DATA_DIR, settings

# ── 프로토콜 정의 ──────────────────────────────────────────────────────────

@runtime_checkable
class UserRepository(Protocol):
    def get(self, username: str) -> dict | None: ...
    def save(self, username: str, data: dict) -> None: ...
    def list_all(self) -> dict: ...
    def delete(self, username: str) -> None: ...


@runtime_checkable
class FavoritesRepository(Protocol):
    def get(self, username: str) -> list[str]: ...
    def add(self, username: str, code: str) -> None: ...
    def remove(self, username: str, code: str) -> None: ...


@runtime_checkable
class PortfolioRepository(Protocol):
    def get(self, username: str) -> list[dict]: ...
    def upsert(self, username: str, item: dict) -> None: ...
    def delete(self, username: str, code: str) -> None: ...


# ── JSON 파일 구현 (현행) ──────────────────────────────────────────────────

class JsonUserRepository:
    _file: Path = DATA_DIR / "users.json"

    def _load(self) -> dict:
        if self._file.exists():
            try:
                return json.loads(self._file.read_text(encoding="utf-8"))
            except Exception:
                pass
        return {}

    def _save(self, data: dict) -> None:
        self._file.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def get(self, username: str) -> dict | None:
        return self._load().get(username)

    def save(self, username: str, data: dict) -> None:
        users = self._load()
        users[username] = data
        self._save(users)

    def list_all(self) -> dict:
        return self._load()

    def delete(self, username: str) -> None:
        users = self._load()
        users.pop(username, None)
        self._save(users)


class JsonFavoritesRepository:
    _file: Path = DATA_DIR / "favorites.json"

    def _load(self) -> dict:
        if self._file.exists():
            try:
                return json.loads(self._file.read_text(encoding="utf-8"))
            except Exception:
                pass
        return {}

    def _save(self, data: dict) -> None:
        self._file.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def get(self, username: str) -> list[str]:
        return self._load().get(username, [])

    def add(self, username: str, code: str) -> None:
        data = self._load()
        codes = data.get(username, [])
        if code not in codes:
            codes.append(code)
        data[username] = codes
        self._save(data)

    def remove(self, username: str, code: str) -> None:
        data = self._load()
        codes = data.get(username, [])
        data[username] = [c for c in codes if c != code]
        self._save(data)


class JsonPortfolioRepository:
    _file: Path = DATA_DIR / "portfolio.json"

    def _load(self) -> dict:
        if self._file.exists():
            try:
                return json.loads(self._file.read_text(encoding="utf-8"))
            except Exception:
                pass
        return {}

    def _save(self, data: dict) -> None:
        self._file.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def get(self, username: str) -> list[dict]:
        return self._load().get(username, [])

    def upsert(self, username: str, item: dict) -> None:
        data = self._load()
        items: list[dict] = data.get(username, [])
        for i, existing in enumerate(items):
            if existing.get("code") == item.get("code"):
                items[i] = item
                break
        else:
            items.append(item)
        data[username] = items
        self._save(data)

    def delete(self, username: str, code: str) -> None:
        data = self._load()
        data[username] = [i for i in data.get(username, []) if i.get("code") != code]
        self._save(data)


# ── PostgreSQL 구현 (DATABASE_URL 있을 때) ─────────────────────────────────
# SQLAlchemy sync 방식으로 구현 (asyncpg 드라이버 선택적 설치)

class PostgresUserRepository:
    def _engine(self):
        from sqlalchemy import create_engine
        url = settings.database_url.replace("+asyncpg", "").replace("postgresql+", "postgresql://", 1)
        if url.startswith("postgresql+asyncpg"):
            url = url.replace("postgresql+asyncpg", "postgresql")
        return create_engine(url)

    def get(self, username: str) -> dict | None:
        from sqlalchemy import text
        with self._engine().connect() as conn:
            row = conn.execute(
                text("SELECT pwd_hash, display, email, plan FROM users WHERE username = :u"),
                {"u": username},
            ).fetchone()
        if not row:
            return None
        return {"pwd_hash": row[0], "display": row[1], "email": row[2], "plan": row[3]}

    def save(self, username: str, data: dict) -> None:
        from sqlalchemy import text
        with self._engine().begin() as conn:
            conn.execute(text("""
                INSERT INTO users (username, pwd_hash, display, email, plan)
                VALUES (:u, :h, :d, :e, :p)
                ON CONFLICT (username) DO UPDATE
                  SET pwd_hash=EXCLUDED.pwd_hash,
                      display=EXCLUDED.display,
                      email=EXCLUDED.email,
                      plan=EXCLUDED.plan
            """), {
                "u": username, "h": data.get("pwd_hash", ""),
                "d": data.get("display", ""), "e": data.get("email", ""),
                "p": data.get("plan", "free"),
            })

    def list_all(self) -> dict:
        from sqlalchemy import text
        with self._engine().connect() as conn:
            rows = conn.execute(
                text("SELECT username, pwd_hash, display, email, plan FROM users")
            ).fetchall()
        return {
            r[0]: {"pwd_hash": r[1], "display": r[2], "email": r[3], "plan": r[4]}
            for r in rows
        }

    def delete(self, username: str) -> None:
        from sqlalchemy import text
        with self._engine().begin() as conn:
            conn.execute(text("DELETE FROM users WHERE username = :u"), {"u": username})


class PostgresFavoritesRepository:
    def _engine(self):
        from sqlalchemy import create_engine
        url = settings.database_url.replace("+asyncpg", "")
        return create_engine(url)

    def get(self, username: str) -> list[str]:
        from sqlalchemy import text
        with self._engine().connect() as conn:
            rows = conn.execute(
                text("SELECT stock_code FROM favorites WHERE username = :u ORDER BY added_at"),
                {"u": username},
            ).fetchall()
        return [r[0] for r in rows]

    def add(self, username: str, code: str) -> None:
        from sqlalchemy import text
        with self._engine().begin() as conn:
            conn.execute(text("""
                INSERT INTO favorites (username, stock_code)
                VALUES (:u, :c)
                ON CONFLICT DO NOTHING
            """), {"u": username, "c": code})

    def remove(self, username: str, code: str) -> None:
        from sqlalchemy import text
        with self._engine().begin() as conn:
            conn.execute(
                text("DELETE FROM favorites WHERE username = :u AND stock_code = :c"),
                {"u": username, "c": code},
            )


class PostgresPortfolioRepository:
    def _engine(self):
        from sqlalchemy import create_engine
        url = settings.database_url.replace("+asyncpg", "")
        return create_engine(url)

    def get(self, username: str) -> list[dict]:
        from sqlalchemy import text
        with self._engine().connect() as conn:
            rows = conn.execute(
                text("SELECT code, name, market, sector, shares, avg_price FROM portfolio WHERE username = :u ORDER BY added_at"),
                {"u": username},
            ).fetchall()
        return [{"code": r[0], "name": r[1], "market": r[2], "sector": r[3],
                 "shares": r[4], "avg_price": float(r[5])} for r in rows]

    def upsert(self, username: str, item: dict) -> None:
        from sqlalchemy import text
        with self._engine().begin() as conn:
            conn.execute(text("""
                INSERT INTO portfolio (username, code, name, market, sector, shares, avg_price)
                VALUES (:u, :code, :name, :market, :sector, :shares, :avg_price)
                ON CONFLICT (username, code) DO UPDATE
                  SET shares=EXCLUDED.shares, avg_price=EXCLUDED.avg_price,
                      name=EXCLUDED.name, market=EXCLUDED.market, sector=EXCLUDED.sector
            """), {"u": username, **item})

    def delete(self, username: str, code: str) -> None:
        from sqlalchemy import text
        with self._engine().begin() as conn:
            conn.execute(
                text("DELETE FROM portfolio WHERE username = :u AND code = :c"),
                {"u": username, "c": code},
            )


# ── 팩토리 함수 ────────────────────────────────────────────────────────────

def get_user_repo() -> JsonUserRepository | PostgresUserRepository:
    if settings.use_postgres:
        return PostgresUserRepository()
    return JsonUserRepository()


def get_favorites_repo() -> JsonFavoritesRepository | PostgresFavoritesRepository:
    if settings.use_postgres:
        return PostgresFavoritesRepository()
    return JsonFavoritesRepository()


def get_portfolio_repo() -> JsonPortfolioRepository | PostgresPortfolioRepository:
    if settings.use_postgres:
        return PostgresPortfolioRepository()
    return JsonPortfolioRepository()
