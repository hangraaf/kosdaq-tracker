"use client";

import { useEffect, useState } from "react";

type Props = { size?: number };

/**
 * PRISM Bauhaus Clock
 * 사이드바 폭에 풀-블리드로 박히는 정사각형 대시보드 디스플레이.
 * Bauhaus 어휘 — 원/사각/삼각 + Primary(노랑/빨강/파랑) — 를
 * 12·3·6·9 인덱스 마크로 사용. 묵직한 직사각 차체 안에 원형 다이얼.
 */
export default function PrismClock({ size }: Props) {
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

  // 사각 캔버스 200x200 — 다이얼 중심 (100,100), 반경 78
  const cx = 100;
  const cy = 100;
  const r = 78;

  const dateLabel = now
    ? now
        .toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit", weekday: "short" })
        .replace(/\s+/g, " ")
        .toUpperCase()
    : "";

  const wrapperStyle: React.CSSProperties = size
    ? { width: size, height: size }
    : { width: "100%", aspectRatio: "1 / 1" };

  return (
    <div
      style={{
        ...wrapperStyle,
        position: "relative",
        display: "block",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.55), 0 12px 28px -18px rgba(0,0,0,0.75)",
        background: "#0c1118",
      }}
      aria-label="현재 시각"
    >
      <svg
        viewBox="0 0 200 200"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block" }}
      >
        <defs>
          {/* 다이얼 패널 — 차콜 차체 */}
          <linearGradient id="bh-panel" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#181d26" />
            <stop offset="55%"  stopColor="#10141b" />
            <stop offset="100%" stopColor="#070a0f" />
          </linearGradient>
          {/* 다이얼 (원) — 미세하게 밝은 안쪽 */}
          <radialGradient id="bh-face" cx="50%" cy="46%" r="62%">
            <stop offset="0%"   stopColor="#1a2230" />
            <stop offset="70%"  stopColor="#0f141c" />
            <stop offset="100%" stopColor="#070a0f" />
          </radialGradient>
          {/* 핸드 — 무광 화이트 */}
          <linearGradient id="bh-hand" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#f4f3ee" />
            <stop offset="100%" stopColor="#c8c6bd" />
          </linearGradient>
        </defs>

        {/* 차체 — 사각 풀블리드 */}
        <rect x="0" y="0" width="200" height="200" fill="url(#bh-panel)" />

        {/* Bauhaus 그리드 — 십자 분할선 (시각적 균형의 축) */}
        <line x1="0"   y1="100" x2="200" y2="100" stroke="rgba(244,243,238,0.05)" strokeWidth="1" />
        <line x1="100" y1="0"   x2="100" y2="200" stroke="rgba(244,243,238,0.05)" strokeWidth="1" />

        {/* 내부 보더 — 차체와 다이얼을 분리하는 얇은 프레임 */}
        <rect
          x="6" y="6" width="188" height="188"
          fill="none"
          stroke="rgba(244,243,238,0.08)"
          strokeWidth="1"
        />

        {/* 다이얼 원 */}
        <circle cx={cx} cy={cy} r={r} fill="url(#bh-face)" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(244,243,238,0.10)" strokeWidth="0.75" />

        {/* 분 눈금 — 60개. 시 단위(5분)는 더 진한 점, 그 외는 미세점 */}
        {Array.from({ length: 60 }).map((_, i) => {
          if (i % 15 === 0) return null; // 12/3/6/9 자리는 도형이 차지
          const isHour = i % 5 === 0;
          const a = (i * 6 * Math.PI) / 180;
          const r1 = isHour ? r - 8 : r - 4;
          const r2 = r - 2;
          const x1 = cx + Math.sin(a) * r1;
          const y1 = cy - Math.cos(a) * r1;
          const x2 = cx + Math.sin(a) * r2;
          const y2 = cy - Math.cos(a) * r2;
          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={isHour ? "rgba(244,243,238,0.55)" : "rgba(244,243,238,0.18)"}
              strokeWidth={isHour ? 1.4 : 0.6}
              strokeLinecap="butt"
            />
          );
        })}

        {/* Bauhaus 인덱스 마크 — 12 노란 원 / 3 빨간 사각 / 6 파란 삼각 / 9 화이트 막대 */}
        {/* 12 — Yellow circle */}
        <circle cx={cx} cy={cy - r + 8} r="5.2" fill="#f3c20d" />
        {/* 3 — Red square */}
        <rect
          x={cx + r - 13} y={cy - 5}
          width="10" height="10"
          fill="#c8362e"
        />
        {/* 6 — Blue triangle (정삼각형, 아래꼭짓점은 다이얼 안쪽 향하도록) */}
        <polygon
          points={`${cx - 6},${cy + r - 12} ${cx + 6},${cy + r - 12} ${cx},${cy + r - 2}`}
          fill="#1f4ea8"
        />
        {/* 9 — White bar */}
        <rect
          x={cx - r + 3} y={cy - 2}
          width="11" height="4"
          fill="#f4f3ee"
        />

        {/* 날짜 윈도우 — 6시 위쪽, Bauhaus 폰트 톤 */}
        <g transform={`translate(${cx} ${cy + 30})`}>
          <rect x="-22" y="-7" width="44" height="14"
            fill="#070a0f"
            stroke="rgba(244,243,238,0.18)"
            strokeWidth="0.5"
          />
          <text
            x="0" y="1"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#f4f3ee"
            fontFamily="'Futura', 'Helvetica Neue', 'Inter', sans-serif"
            fontSize="6.4"
            fontWeight={600}
            letterSpacing="0.22em"
          >
            {dateLabel}
          </text>
        </g>

        {/* 시침 — 굵은 직사각형 (화이트) */}
        <g transform={`rotate(${hourDeg} ${cx} ${cy})`}>
          <rect
            x={cx - 2.8} y={cy - 44}
            width="5.6" height="50"
            fill="url(#bh-hand)"
          />
        </g>

        {/* 분침 — 얇고 긴 직사각형 (화이트) */}
        <g transform={`rotate(${minDeg} ${cx} ${cy})`}>
          <rect
            x={cx - 1.6} y={cy - 64}
            width="3.2" height="72"
            fill="url(#bh-hand)"
          />
        </g>

        {/* 초침 — 빨강 라인 + 끝점에 노란 원 (Bauhaus 컬러 시퀀스) */}
        <g transform={`rotate(${secDeg} ${cx} ${cy})`}>
          <line
            x1={cx} y1={cy + 14}
            x2={cx} y2={cy - 66}
            stroke="#c8362e"
            strokeWidth="1.1"
            strokeLinecap="butt"
          />
          <circle cx={cx} cy={cy - 66} r="2.6" fill="#f3c20d" />
        </g>

        {/* 중심 핀 — 검정 원 + 화이트 코어 */}
        <circle cx={cx} cy={cy} r="4" fill="#070a0f" />
        <circle cx={cx} cy={cy} r="1.4" fill="#f4f3ee" />

        {/* 하단 워드마크 — Bauhaus 산세리프 */}
        <text
          x="100" y="192"
          textAnchor="middle"
          fill="rgba(244,243,238,0.42)"
          fontFamily="'Futura', 'Helvetica Neue', 'Inter', sans-serif"
          fontSize="6"
          fontWeight={700}
          letterSpacing="0.42em"
        >
          PRISM
        </text>
      </svg>
    </div>
  );
}
