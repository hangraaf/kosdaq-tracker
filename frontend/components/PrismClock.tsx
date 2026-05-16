"use client";

import { useEffect, useState } from "react";

type Props = { size?: number };

export default function PrismClock({ size = 132 }: Props) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const s = now ? now.getSeconds() + now.getMilliseconds() / 1000 : 0;
  const m = now ? now.getMinutes() + s / 60 : 0;
  const h = now ? (now.getHours() % 12) + m / 60 : 0;

  const secDeg = s * 6;
  const minDeg = m * 6;
  const hourDeg = h * 30;

  const cx = 100;
  const cy = 100;
  const r = 92;

  const dateLabel = now
    ? now.toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" })
    : "";

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        margin: "0 auto",
        filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.35))",
      }}
      aria-label="현재 시각"
    >
      <svg viewBox="0 0 200 200" width={size} height={size}>
        <defs>
          <radialGradient id="prism-clock-face" cx="50%" cy="42%" r="62%">
            <stop offset="0%"  stopColor="#2a4d6b" />
            <stop offset="55%" stopColor="#172e44" />
            <stop offset="100%" stopColor="#0c1a28" />
          </radialGradient>
          <linearGradient id="prism-clock-bezel" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#d8e2dd" />
            <stop offset="35%"  stopColor="#8c9a93" />
            <stop offset="55%"  stopColor="#384b42" />
            <stop offset="100%" stopColor="#aeb9b2" />
          </linearGradient>
          <linearGradient id="prism-clock-hand" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#f6fbf1" />
            <stop offset="100%" stopColor="#abe1b7" />
          </linearGradient>
          <radialGradient id="prism-clock-glow" cx="50%" cy="40%" r="55%">
            <stop offset="0%"   stopColor="rgba(171,225,183,0.18)" />
            <stop offset="100%" stopColor="rgba(171,225,183,0)" />
          </radialGradient>
        </defs>

        {/* 외곽 베젤 */}
        <circle cx={cx} cy={cy} r={r + 6} fill="url(#prism-clock-bezel)" />
        <circle cx={cx} cy={cy} r={r + 3} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="1" />

        {/* 다이얼 */}
        <circle cx={cx} cy={cy} r={r} fill="url(#prism-clock-face)" />
        <circle cx={cx} cy={cy} r={r} fill="url(#prism-clock-glow)" />

        {/* 분 눈금 */}
        {Array.from({ length: 60 }).map((_, i) => {
          const isHour = i % 5 === 0;
          const a = (i * 6 * Math.PI) / 180;
          const r1 = isHour ? r - 10 : r - 5;
          const r2 = r - 2;
          const x1 = cx + Math.sin(a) * r1;
          const y1 = cy - Math.cos(a) * r1;
          const x2 = cx + Math.sin(a) * r2;
          const y2 = cy - Math.cos(a) * r2;
          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={isHour ? "rgba(246,251,241,0.92)" : "rgba(220,232,222,0.32)"}
              strokeWidth={isHour ? 2 : 1}
              strokeLinecap="round"
            />
          );
        })}

        {/* 12·3·6·9 로마 숫자 — 롤스로이스 톤 */}
        {[
          { n: "XII", x: 100, y: 30 },
          { n: "III", x: 168, y: 104 },
          { n: "VI",  x: 100, y: 174 },
          { n: "IX",  x: 32,  y: 104 },
        ].map(({ n, x, y }) => (
          <text
            key={n}
            x={x} y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(246,251,241,0.88)"
            fontFamily="'Cormorant Garamond', 'Times New Roman', serif"
            fontSize="13"
            fontWeight={600}
            letterSpacing="0.04em"
          >
            {n}
          </text>
        ))}

        {/* 날짜 윈도우 — Rolls-Royce 데이트 디스크 느낌 */}
        <g transform={`translate(${cx} ${cy + 32})`}>
          <rect x="-26" y="-9" width="52" height="18" rx="3"
            fill="rgba(0,0,0,0.45)"
            stroke="rgba(171,225,183,0.20)"
            strokeWidth="0.75"
          />
          <text
            x="0" y="1"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(220,232,222,0.92)"
            fontFamily="var(--maru)"
            fontSize="8.5"
            letterSpacing="0.14em"
          >
            {dateLabel.toUpperCase()}
          </text>
        </g>

        {/* 시침 */}
        <g transform={`rotate(${hourDeg} ${cx} ${cy})`}>
          <rect x={cx - 2.6} y={cy - 50} width="5.2" height="58" rx="2"
            fill="url(#prism-clock-hand)"
            stroke="rgba(0,0,0,0.35)" strokeWidth="0.5"
          />
        </g>

        {/* 분침 */}
        <g transform={`rotate(${minDeg} ${cx} ${cy})`}>
          <rect x={cx - 1.8} y={cy - 72} width="3.6" height="82" rx="1.8"
            fill="url(#prism-clock-hand)"
            stroke="rgba(0,0,0,0.30)" strokeWidth="0.5"
          />
        </g>

        {/* 초침 — 분광 spectrum 강조 */}
        <g transform={`rotate(${secDeg} ${cx} ${cy})`}>
          <line
            x1={cx} y1={cy + 16}
            x2={cx} y2={cy - 80}
            stroke="#b5453f"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy - 64} r="3"
            fill="none"
            stroke="#b5453f"
            strokeWidth="1.2"
          />
        </g>

        {/* 중심 핀 */}
        <circle cx={cx} cy={cy} r="3.8" fill="#f6fbf1" />
        <circle cx={cx} cy={cy} r="1.6" fill="#0c1a28" />
      </svg>
    </div>
  );
}
