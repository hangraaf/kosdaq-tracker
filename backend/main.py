"""KOSDAQ Tracker — FastAPI 백엔드."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import auth, payments, portfolio, robo, stocks

app = FastAPI(
    title="KOSDAQ Tracker API",
    description="Mr. Stock Buddy — PRISM™ 기반 한국 주식 트래커",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.all_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(stocks.router)
app.include_router(portfolio.router)
app.include_router(robo.router)
app.include_router(payments.router)


@app.get("/")
def root():
    return {"message": "Mr. Stock Buddy API v2.0 — PRISM™ Engine Active"}


@app.get("/health")
def health():
    return {"status": "ok"}
