"""KIS 실시간 주가 WebSocket 클라이언트 (H0STCNT0 — 주식체결)."""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

WS_URLS: dict[str, str] = {
    "prod":  "ws://ops.koreainvestment.com:21000",
    "mock":  "ws://ops.koreainvestment.com:31000",
    "paper": "ws://ops.koreainvestment.com:31000",
    "vps":   "ws://ops.koreainvestment.com:31000",
}

TR_STOCK_QUOTE = "H0STCNT0"


class KISRealtimeManager:
    """KIS WebSocket 실시간 가격 브로커 (싱글턴)."""

    def __init__(self) -> None:
        self._ws: Any = None
        self._task: asyncio.Task | None = None
        self._approval_key: str = ""
        self._env: str = "prod"
        self._subscribers: dict[str, set[asyncio.Queue]] = {}
        self._lock = asyncio.Lock()

    async def start(self, approval_key: str, env: str = "prod") -> None:
        self._approval_key = approval_key
        self._env = env
        if self._task and not self._task.done():
            return
        self._task = asyncio.create_task(self._run())

    async def subscribe(self, code: str, queue: asyncio.Queue) -> None:
        async with self._lock:
            if code not in self._subscribers:
                self._subscribers[code] = set()
                await self._send_sub(code, subscribe=True)
            self._subscribers[code].add(queue)

    async def unsubscribe(self, code: str, queue: asyncio.Queue) -> None:
        async with self._lock:
            if code in self._subscribers:
                self._subscribers[code].discard(queue)
                if not self._subscribers[code]:
                    del self._subscribers[code]
                    await self._send_sub(code, subscribe=False)

    async def _send_sub(self, code: str, *, subscribe: bool) -> None:
        if not self._ws:
            return
        msg = json.dumps({
            "header": {
                "approval_key": self._approval_key,
                "custtype": "P",
                "tr_type": "1" if subscribe else "2",
                "content-type": "utf-8",
            },
            "body": {"input": {"tr_id": TR_STOCK_QUOTE, "tr_key": code}},
        })
        try:
            await self._ws.send(msg)
        except Exception:
            pass

    async def _run(self) -> None:
        import websockets

        url = WS_URLS.get(self._env, WS_URLS["prod"])
        while True:
            try:
                async with websockets.connect(url, ping_interval=20) as ws:
                    self._ws = ws
                    # 재연결 시 기존 구독 복원
                    async with self._lock:
                        for code in list(self._subscribers.keys()):
                            await self._send_sub(code, subscribe=True)
                    async for raw in ws:
                        self._dispatch(str(raw))
            except Exception as e:
                logger.warning(f"KIS WS 연결 끊김, 5초 후 재시도: {e}")
                self._ws = None
                await asyncio.sleep(5)

    def _dispatch(self, raw: str) -> None:
        # JSON 제어 메시지(핑퐁·에러)는 무시
        if raw.startswith("{"):
            return
        # 데이터 형식: {type}|{tr_id}|{cnt}|{data}
        parts = raw.split("|", 3)
        if len(parts) < 4:
            return
        if parts[1] != TR_STOCK_QUOTE:
            return
        fields = parts[3].split("^")
        if not fields:
            return
        code = fields[0]
        try:
            parsed: dict[str, Any] = {
                "code":        code,
                "price":       int(fields[2])   if len(fields) > 2  else 0,
                "change":      int(fields[4])   if len(fields) > 4  else 0,
                "change_rate": float(fields[5]) if len(fields) > 5  else 0.0,
                "volume":      int(fields[13])  if len(fields) > 13 else 0,
                "time":        fields[1]        if len(fields) > 1  else "",
            }
        except (ValueError, IndexError):
            return
        for queue in self._subscribers.get(code, set()):
            try:
                queue.put_nowait(parsed)
            except asyncio.QueueFull:
                pass


_manager: KISRealtimeManager | None = None


def get_realtime_manager() -> KISRealtimeManager:
    global _manager
    if _manager is None:
        _manager = KISRealtimeManager()
    return _manager
