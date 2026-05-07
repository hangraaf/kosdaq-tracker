"""관심종목 & 포트폴리오 라우터."""
from __future__ import annotations

import json
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException

from config import DATA_DIR
from models import PortfolioAdd, PortfolioEntry
from routers.auth import get_current_user
from stock_data import STOCK_MAP
from utils import stock_demo_snapshot

router = APIRouter(tags=["portfolio"])

FAV_FILE = DATA_DIR / "favorites.json"
PORT_FILE = DATA_DIR / "portfolio.json"


def _load_json(path) -> dict:
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _save_json(path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


# ── 관심종목 ──────────────────────────────────────────────────────────────

@router.get("/favorites")
def get_favorites(user: Annotated[dict, Depends(get_current_user)]):
    data = _load_json(FAV_FILE)
    codes = data.get(user["username"], [])
    result = []
    for code in codes:
        stock = STOCK_MAP.get(code)
        if stock:
            snap = stock_demo_snapshot(code, stock.name, stock.market, stock.sector, stock.base_price)
            result.append(snap)
    return result


@router.post("/favorites/{code}")
def add_favorite(code: str, user: Annotated[dict, Depends(get_current_user)]):
    if code not in STOCK_MAP:
        raise HTTPException(404, detail="종목 코드를 찾을 수 없습니다.")
    data = _load_json(FAV_FILE)
    favs = data.get(user["username"], [])
    if code not in favs:
        favs.append(code)
    data[user["username"]] = favs
    _save_json(FAV_FILE, data)
    return {"ok": True, "count": len(favs)}


@router.delete("/favorites/{code}")
def remove_favorite(code: str, user: Annotated[dict, Depends(get_current_user)]):
    data = _load_json(FAV_FILE)
    favs = data.get(user["username"], [])
    favs = [c for c in favs if c != code]
    data[user["username"]] = favs
    _save_json(FAV_FILE, data)
    return {"ok": True, "count": len(favs)}


# ── 포트폴리오 ───────────────────────────────────────────────────────────

@router.get("/portfolio")
def get_portfolio(user: Annotated[dict, Depends(get_current_user)]):
    data = _load_json(PORT_FILE)
    entries = data.get(user["username"], [])
    result = []
    total_value = 0
    total_cost = 0
    for e in entries:
        stock = STOCK_MAP.get(e["code"])
        if not stock:
            continue
        snap = stock_demo_snapshot(e["code"], stock.name, stock.market, stock.sector, stock.base_price)
        current_price = snap["price"]
        avg_price = e["avg_price"]
        shares = e["shares"]
        current_value = current_price * shares
        cost = avg_price * shares
        pnl = current_value - cost
        pnl_pct = pnl / cost * 100 if cost > 0 else 0
        total_value += current_value
        total_cost += cost
        result.append({
            **e,
            "current_price": current_price,
            "current_value": current_value,
            "pnl": pnl,
            "pnl_pct": round(pnl_pct, 2),
            "change_rate": snap["change_rate"],
        })
    total_pnl = total_value - total_cost
    total_pnl_pct = total_pnl / total_cost * 100 if total_cost > 0 else 0
    return {
        "items": result,
        "total_value": total_value,
        "total_cost": total_cost,
        "total_pnl": total_pnl,
        "total_pnl_pct": round(total_pnl_pct, 2),
    }


@router.post("/portfolio")
def add_to_portfolio(body: PortfolioAdd, user: Annotated[dict, Depends(get_current_user)]):
    stock = STOCK_MAP.get(body.code)
    if not stock:
        raise HTTPException(404, detail="종목 코드를 찾을 수 없습니다.")
    data = _load_json(PORT_FILE)
    entries = data.get(user["username"], [])
    existing = next((e for e in entries if e["code"] == body.code), None)
    if existing:
        total_shares = existing["shares"] + body.shares
        existing["avg_price"] = (existing["avg_price"] * existing["shares"] + body.avg_price * body.shares) / total_shares
        existing["shares"] = total_shares
    else:
        entries.append({
            "code": body.code, "name": stock.name,
            "market": stock.market, "sector": stock.sector,
            "shares": body.shares, "avg_price": body.avg_price,
        })
    data[user["username"]] = entries
    _save_json(PORT_FILE, data)
    return {"ok": True}


@router.delete("/portfolio/{code}")
def remove_from_portfolio(code: str, user: Annotated[dict, Depends(get_current_user)]):
    data = _load_json(PORT_FILE)
    entries = data.get(user["username"], [])
    entries = [e for e in entries if e["code"] != code]
    data[user["username"]] = entries
    _save_json(PORT_FILE, data)
    return {"ok": True}
