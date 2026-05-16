"use client";

import { useEffect, useState } from "react";

/** 헤더 우측 미니멀 디지털 시계 — KRX 세션 라벨 + HH:MM */
function getSession(h: number, m: number): { label: string; active: boolean } {
  const t = h * 60 + m;
  // KRX 정규장 09:00–15:30
  if (t >= 540 && t < 930) return { label: "장중",   active: true };
  if (t >= 480 && t < 540) return { label: "동시호가", active: true };
  if (t >= 930 && t < 960) return { label: "마감동시", active: true };
  return { label: "장마감", active: false };
}

export default function HeaderClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return <span className="psl-clock" aria-hidden style={{ visibility: "hidden" }}>KRX 00:00 · 장마감</span>;
  }

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const session = getSession(now.getHours(), now.getMinutes());

  return (
    <span className="psl-clock" title="한국거래소 KRX 기준">
      <span className="psl-clock-session">KRX</span>
      {hh}:{mm} · {session.label}
    </span>
  );
}
