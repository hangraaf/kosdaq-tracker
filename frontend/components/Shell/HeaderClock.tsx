"use client";

import { useEffect, useState } from "react";

/** 헤더 우측 픽셀 LCD 시계 — KRX 세션 라벨 + HH:MM:SS */
function getSession(h: number, m: number): { label: string; active: boolean } {
  const t = h * 60 + m;
  if (t >= 540 && t < 930) return { label: "장중",     active: true };
  if (t >= 480 && t < 540) return { label: "동시호가", active: true };
  if (t >= 930 && t < 960) return { label: "마감동시", active: true };
  return { label: "장마감", active: false };
}

export default function HeaderClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return (
      <span className="psl-clock" aria-hidden style={{ visibility: "hidden" }}>
        KRX 00:00:00
      </span>
    );
  }

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const session = getSession(now.getHours(), now.getMinutes());

  return (
    <span className="psl-clock" title="한국거래소 KRX 기준">
      <span className="psl-clock-tag">KRX</span>
      <span className="psl-clock-lcd" aria-label={`${hh}시 ${mm}분 ${ss}초`}>
        <span className="psl-clock-digits">{hh}</span>
        <span className="psl-clock-colon">:</span>
        <span className="psl-clock-digits">{mm}</span>
        <span className="psl-clock-colon">:</span>
        <span className="psl-clock-digits">{ss}</span>
      </span>
      <span className={`psl-clock-session${session.active ? " is-on" : ""}`}>
        <span className="psl-clock-dot" aria-hidden />
        {session.label}
      </span>
    </span>
  );
}
