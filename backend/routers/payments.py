"""토스페이먼츠 결제 라우터 — 프리미엄 구독."""
from __future__ import annotations

import json
import uuid
from typing import Annotated

import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from config import DATA_DIR, settings
from routers.auth import get_current_user

router = APIRouter(prefix="/payments", tags=["payments"])

TOSS_CONFIRM_URL = "https://api.tosspayments.com/v1/payments/confirm"
USERS_FILE = DATA_DIR / "users.json"

PLANS = {
    "premium_monthly": {"name": "PREMIUM 월간", "amount": 9900,  "period": 30},
    "premium_yearly":  {"name": "PREMIUM 연간", "amount": 99000, "period": 365},
}


def _load_users() -> dict:
    if USERS_FILE.exists():
        try:
            return json.loads(USERS_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _save_users(users: dict) -> None:
    USERS_FILE.write_text(json.dumps(users, ensure_ascii=False, indent=2), encoding="utf-8")


class PaymentConfirmRequest(BaseModel):
    payment_key: str
    order_id: str
    amount: int
    plan_id: str


class OrderCreateRequest(BaseModel):
    plan_id: str


@router.get("/plans")
def get_plans():
    return [{"id": k, **v} for k, v in PLANS.items()]


@router.post("/order")
def create_order(
    body: OrderCreateRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    plan = PLANS.get(body.plan_id)
    if not plan:
        raise HTTPException(400, detail="존재하지 않는 플랜입니다.")
    order_id = f"bh-{user['username']}-{uuid.uuid4().hex[:12]}"
    return {
        "order_id":    order_id,
        "order_name":  plan["name"],
        "amount":      plan["amount"],
        "client_key":  settings.toss_client_key or "test_ck_placeholder",
        "customer_name": user["display"],
    }


@router.post("/confirm")
def confirm_payment(
    body: PaymentConfirmRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    plan = PLANS.get(body.plan_id)
    if not plan:
        raise HTTPException(400, detail="존재하지 않는 플랜입니다.")
    if body.amount != plan["amount"]:
        raise HTTPException(400, detail="결제 금액이 일치하지 않습니다.")

    secret_key = settings.toss_secret_key
    if secret_key and not secret_key.startswith("test_sk_placeholder"):
        import base64
        encoded = base64.b64encode(f"{secret_key}:".encode()).decode()
        resp = requests.post(
            TOSS_CONFIRM_URL,
            headers={"Authorization": f"Basic {encoded}", "Content-Type": "application/json"},
            json={"paymentKey": body.payment_key, "orderId": body.order_id, "amount": body.amount},
            timeout=10,
        )
        if resp.status_code != 200:
            err = resp.json().get("message", "결제 확인 실패")
            raise HTTPException(400, detail=err)

    # 결제 성공 → 유저 플랜 업그레이드
    users = _load_users()
    uname = user["username"]
    if uname in users:
        users[uname]["plan"] = "premium"
        _save_users(users)

    return {"ok": True, "plan": "premium", "message": "프리미엄 구독이 활성화되었습니다!"}


@router.post("/cancel")
def cancel_subscription(user: Annotated[dict, Depends(get_current_user)]):
    users = _load_users()
    uname = user["username"]
    if uname in users:
        users[uname]["plan"] = "free"
        _save_users(users)
    return {"ok": True, "plan": "free"}
