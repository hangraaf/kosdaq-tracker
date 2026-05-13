from __future__ import annotations

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    # JWT
    secret_key: str = "change-me-in-production-please-use-env"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7일

    # KIS API
    kis_app_key: str = ""
    kis_app_secret: str = ""
    kis_env: str = "prod"

    # 토스페이먼츠
    toss_client_key: str = ""
    toss_secret_key: str = ""

    # PostgreSQL (선택 — 설정 시 JSON+SQLite 대신 PG 사용)
    database_url: str = ""   # postgresql+asyncpg://user:pass@host/db
    use_postgres: bool = False

    def model_post_init(self, __context) -> None:
        if self.database_url:
            object.__setattr__(self, "use_postgres", True)

    # CORS — 개발 + 배포 주소
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "https://mr-stock-buddy-app.vercel.app",
        "https://mr-stock-buddy.vercel.app",
    ]
    cors_origins_extra: str = ""

    def all_cors_origins(self) -> list[str]:
        extras = [o.strip() for o in self.cors_origins_extra.split(",") if o.strip()]
        return self.cors_origins + extras


settings = Settings()
