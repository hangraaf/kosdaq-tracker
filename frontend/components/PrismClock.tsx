"use client";

import { useEffect, useState } from "react";

type Props = { size?: number };

/**
 * PRISM Clock — Junghans Max Bill 톤
 * 오프화이트 원형 다이얼, 그린 포인트.
 * 외곽 링에 1~31 일자 숫자, 하단 아크에 요일 한자(日月火水木金土) 배치.
 * 오늘 날짜·요일은 그린으로 강조.
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

  // 200x200 캔버스, 중심 (100,100)
  const cx = 100;
  const cy = 100;

  // 링 반경
  const rOuter = 96;       // 외곽 케이스
  const rDateRing = 86;    // 날짜 숫자 트랙
  const rDial = 76;        // 다이얼 면
  const rHourEnd = 71;     // 시 인덱스 안쪽 끝
  const rHourStart = 64;   // 시 인덱스 바깥쪽 끝(원 안쪽)
  const rMinDot = 70;      // 분 도트

  // 컬러 — 융한스 톤
  const OFF_WHITE = "#ece4d2";
  const OFF_WHITE_HI = "#f5efe1";
  const INK = "#1a1a1a";
  const INK_SOFT = "#2a2a2a";
  const HAIRLINE = "rgba(26,26,26,0.18)";
  const HAIRLINE_FAINT = "rgba(26,26,26,0.10)";
  const GREEN = "#2f7d4f";
  const GREEN_DEEP = "#1f5e3a";

  const today = now ? now.getDate() : 0;
  const dow = now ? now.getDay() : 0; // 0=일 ... 6=토
  // 일 월 화 수 목 금 토 → 日 月 火 水 木 金 土
  const dayChars = ["日", "月", "火", "水", "木", "金", "土"];

  const wrapperStyle: React.CSSProperties = size
    ? { width: size, height: size }
    : { width: "100%", aspectRatio: "1 / 1" };

  return (
    <div
      style={{
        ...wrapperStyle,
        position: "relative",
        display: "block",
        background: "#0c1118",
        padding: 8,
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
          <radialGradient id="jh-face" cx="50%" cy="44%" r="62%">
            <stop offset="0%"   stopColor={OFF_WHITE_HI} />
            <stop offset="70%"  stopColor={OFF_WHITE} />
            <stop offset="100%" stopColor="#dfd6c1" />
          </radialGradient>
          <linearGradient id="jh-case" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#dcd3bd" />
            <stop offset="50%"  stopColor="#c8bfa9" />
            <stop offset="100%" stopColor="#9d9582" />
          </linearGradient>
          <linearGradient id="jh-hand" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#222" />
            <stop offset="100%" stopColor="#0c0c0c" />
          </linearGradient>
        </defs>

        {/* 케이스 외곽 */}
        <circle cx={cx} cy={cy} r={rOuter} fill="url(#jh-case)" />
        <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="0.6" />
        <circle cx={cx} cy={cy} r={rOuter - 2.5} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.4" />

        {/* 다이얼 */}
        <circle cx={cx} cy={cy} r={rDial + 6} fill="url(#jh-face)" />
        <circle cx={cx} cy={cy} r={rDial + 6} fill="none" stroke={HAIRLINE_FAINT} strokeWidth="0.4" />

        {/* 날짜 숫자 링 1~31 — 외곽 링 트랙 */}
        {Array.from({ length: 31 }).map((_, i) => {
          const dayNum = i + 1;
          // 1일을 12시 방향에서 시작해 시계방향으로 분포
          const ang = -90 + (i / 31) * 360;
          const rr = ((ang) * Math.PI) / 180;
          const x = cx + Math.cos(rr) * rDateRing;
          const y = cy + Math.sin(rr) * rDateRing;
          const isToday = dayNum === today;
          return (
            <g key={`d-${dayNum}`} transform={`translate(${x} ${y}) rotate(${ang + 90})`}>
              {isToday && (
                <circle
                  cx="0" cy="0" r="5.2"
                  fill={GREEN}
                  stroke={GREEN_DEEP}
                  strokeWidth="0.4"
                />
              )}
              <text
                x="0" y="0"
                textAnchor="middle"
                dominantBaseline="central"
                fill={isToday ? OFF_WHITE_HI : INK_SOFT}
                fontFamily="'Helvetica Neue', 'Inter', sans-serif"
                fontSize={isToday ? 5.2 : 4.4}
                fontWeight={isToday ? 700 : 500}
                letterSpacing="0.02em"
              >
                {dayNum}
              </text>
            </g>
          );
        })}

        {/* 다이얼과 날짜 링 분리 헤어라인 */}
        <circle cx={cx} cy={cy} r={rDial + 4} fill="none" stroke={HAIRLINE} strokeWidth="0.35" />

        {/* 분 눈금 — 60 도트 (시 위치 제외) */}
        {Array.from({ length: 60 }).map((_, i) => {
          if (i % 5 === 0) return null;
          const a = (i * 6 * Math.PI) / 180;
          const x = cx + Math.sin(a) * rMinDot;
          const y = cy - Math.cos(a) * rMinDot;
          return <circle key={`m-${i}`} cx={x} cy={y} r="0.55" fill={HAIRLINE} />;
        })}

        {/* 시 인덱스 — 슬림 바통 12개 */}
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i * 30 * Math.PI) / 180;
          const x1 = cx + Math.sin(a) * rHourStart;
          const y1 = cy - Math.cos(a) * rHourStart;
          const x2 = cx + Math.sin(a) * rHourEnd;
          const y2 = cy - Math.cos(a) * rHourEnd;
          return (
            <line
              key={`h-${i}`}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={INK}
              strokeWidth={i === 0 ? 1.8 : 1.1}
              strokeLinecap="butt"
            />
          );
        })}

        {/* 요일 한자 아크 — 6시 방향 위쪽, 7글자 부채꼴 */}
        {dayChars.map((ch, i) => {
          // -60도 ~ +60도 구간(시계 좌표에서 6시 기준 ±) — 6시 = 180도
          // 7개를 균등하게 펼치되, 5시(150°)~7시(210°)는 너무 좁으니 130°~230°로
          const start = 130;
          const end = 230;
          const ang = start + ((end - start) * i) / (dayChars.length - 1);
          const rArc = 42;
          const rr = (ang * Math.PI) / 180;
          const x = cx + Math.cos(rr) * rArc;
          const y = cy + Math.sin(rr) * rArc;
          const isToday = i === dow;
          return (
            <g key={`dow-${i}`} transform={`translate(${x} ${y})`}>
              {isToday && (
                <circle cx="0" cy="0" r="5.4" fill={GREEN} />
              )}
              <text
                x="0" y="0.4"
                textAnchor="middle"
                dominantBaseline="central"
                fill={isToday ? OFF_WHITE_HI : INK_SOFT}
                fontFamily="'Noto Serif KR', 'Songti SC', 'STSong', serif"
                fontSize={isToday ? 6.2 : 5.4}
                fontWeight={isToday ? 700 : 500}
              >
                {ch}
              </text>
            </g>
          );
        })}

        {/* 워드마크 — 12시 아래 */}
        <text
          x="100" y="40"
          textAnchor="middle"
          fill={INK_SOFT}
          fontFamily="'Helvetica Neue', 'Inter', sans-serif"
          fontSize="4.4"
          fontWeight={700}
          letterSpacing="0.42em"
        >
          PRISM
        </text>
        <text
          x="100" y="46"
          textAnchor="middle"
          fill={GREEN}
          fontFamily="'Helvetica Neue', 'Inter', sans-serif"
          fontSize="2.8"
          fontWeight={500}
          letterSpacing="0.32em"
        >
          KOSDAQ TRACKER
        </text>

        {/* 시침 */}
        <g transform={`rotate(${hourDeg} ${cx} ${cy})`}>
          <rect
            x={cx - 1.6} y={cy - 44}
            width="3.2" height="50"
            fill="url(#jh-hand)"
            rx="0.5"
          />
        </g>

        {/* 분침 */}
        <g transform={`rotate(${minDeg} ${cx} ${cy})`}>
          <rect
            x={cx - 1.1} y={cy - 64}
            width="2.2" height="72"
            fill="url(#jh-hand)"
            rx="0.5"
          />
        </g>

        {/* 초침 — 그린 */}
        <g transform={`rotate(${secDeg} ${cx} ${cy})`}>
          <line
            x1={cx} y1={cy + 16}
            x2={cx} y2={cy - 68}
            stroke={GREEN}
            strokeWidth="0.9"
            strokeLinecap="butt"
          />
          <circle cx={cx} cy={cy - 62} r="2.2" fill={GREEN} />
        </g>

        {/* 중심 핀 */}
        <circle cx={cx} cy={cy} r="2.6" fill={INK} />
        <circle cx={cx} cy={cy} r="0.9" fill={OFF_WHITE_HI} />
      </svg>
    </div>
  );
}
