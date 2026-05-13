-- KOSDAQ Tracker — PostgreSQL 초기 스키마
-- docker-compose 시작 시 자동 실행 (docker-entrypoint-initdb.d)

CREATE TABLE IF NOT EXISTS users (
    username   VARCHAR(30)  PRIMARY KEY,
    pwd_hash   VARCHAR(72)  NOT NULL,      -- bcrypt 출력 길이
    display    VARCHAR(100) NOT NULL DEFAULT '',
    email      VARCHAR(255) NOT NULL DEFAULT '',
    plan       VARCHAR(20)  NOT NULL DEFAULT 'free',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favorites (
    username   VARCHAR(30) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    stock_code VARCHAR(10) NOT NULL,
    added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (username, stock_code)
);

CREATE TABLE IF NOT EXISTS portfolio (
    username   VARCHAR(30)    NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    code       VARCHAR(10)    NOT NULL,
    name       VARCHAR(100)   NOT NULL DEFAULT '',
    market     VARCHAR(20)    NOT NULL DEFAULT '',
    sector     VARCHAR(50)    NOT NULL DEFAULT '',
    shares     INTEGER        NOT NULL,
    avg_price  NUMERIC(12, 2) NOT NULL,
    added_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    PRIMARY KEY (username, code)
);

CREATE TABLE IF NOT EXISTS price_cache (
    code         VARCHAR(10) PRIMARY KEY,
    price        INTEGER     NOT NULL DEFAULT 0,
    change_val   INTEGER     NOT NULL DEFAULT 0,
    change_rate  NUMERIC(8, 4) NOT NULL DEFAULT 0,
    volume       INTEGER     NOT NULL DEFAULT 0,
    market_cap   BIGINT      NOT NULL DEFAULT 0,
    updated_at   DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS chart_cache (
    cache_key  VARCHAR(30) PRIMARY KEY,
    data_json  TEXT        NOT NULL,
    updated_at DOUBLE PRECISION NOT NULL DEFAULT 0
);
