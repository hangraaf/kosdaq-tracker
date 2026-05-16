"use client";

import { useEffect, useRef, useState } from "react";

/**
 * PURPLE STOCK SLIME — 픽셀 고스트 마스코트 + 워드마크
 * 컴포넌트 이름은 레거시 호환을 위해 유지.
 *
 * 14×14 픽셀 그리드. 눈 흰자는 3×3 풀, 동공(1×1)은 커서 위치에 따라
 * 흰자 안에서 9포지션(중앙+8방향)으로 점프 이동.
 *
 *  '#' = 바디 (퍼플)
 *  'O' = 눈 흰자
 *  '.' = 투명
 */
const GHOST_GRID = [
  "....######....",
  "..##########..",
  ".############.",
  "##############",
  "##OOO####OOO##",
  "##OOO####OOO##",
  "##OOO####OOO##",
  "##############",
  "##############",
  "##############",
  "##############",
  "##############",
  "##.##.##.##.##",
  "#...##..##...#",
];

const COLS = 14;
const ROWS = GHOST_GRID.length;

// 각 눈 흰자의 중앙 픽셀 — 동공 base 위치
const LEFT_EYE_BASE = { x: 3, y: 5 };
const RIGHT_EYE_BASE = { x: 10, y: 5 };

interface Cell { x: number; y: number; kind: "body" | "eye" }

const STATIC_CELLS: Cell[] = (() => {
  const out: Cell[] = [];
  for (let y = 0; y < ROWS; y++) {
    const row = GHOST_GRID[y];
    for (let x = 0; x < COLS; x++) {
      const ch = row[x];
      if (ch === "#") out.push({ x, y, kind: "body" });
      else if (ch === "O") out.push({ x, y, kind: "eye" });
    }
  }
  return out;
})();

/** 커서 방향 → 8방향 + 중앙 매핑. dx/dy는 ghost 중심에서 cursor까지 벡터. */
function pickPupilOffset(dx: number, dy: number): [number, number] {
  const len = Math.hypot(dx, dy);
  if (len < 8) return [0, 0]; // 데드존 — 너무 가까우면 중앙 응시
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  // 22.5° 경계 (tan ≈ 0.414). 한 축이 이 비율보다 크면 그 방향 성분 활성화.
  let ox = 0;
  let oy = 0;
  if (ax > ay * 0.414) ox = Math.sign(dx);
  if (ay > ax * 0.414) oy = Math.sign(dy);
  return [ox, oy];
}

function PixelGhost({ size, title }: { size: number; title?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [offset, setOffset] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    // 터치 디바이스에서는 시선 추적 비활성 (눈 중앙 고정)
    if (typeof window === "undefined") return;
    if (window.matchMedia && window.matchMedia("(hover: none)").matches) return;

    let raf = 0;
    let lastX = 0;
    let lastY = 0;

    const tick = () => {
      raf = 0;
      const svg = svgRef.current;
      if (!svg) return;
      const r = svg.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const [ox, oy] = pickPupilOffset(lastX - cx, lastY - cy);
      setOffset(prev => (prev[0] === ox && prev[1] === oy ? prev : [ox, oy]));
    };

    const onMove = (e: MouseEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const [ox, oy] = offset;

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox={`0 0 ${COLS} ${ROWS}`}
      shapeRendering="crispEdges"
      role={title ? "img" : "presentation"}
      aria-label={title}
      style={{ display: "block" }}
    >
      {STATIC_CELLS.map(({ x, y, kind }, i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width={1}
          height={1}
          fill={kind === "body" ? "var(--purple)" : "#ffffff"}
        />
      ))}
      {/* 동공 — 커서 방향에 따라 흰자 안에서 9포지션 점프 */}
      <rect
        x={LEFT_EYE_BASE.x + ox}
        y={LEFT_EYE_BASE.y + oy}
        width={1}
        height={1}
        fill="var(--purple)"
      />
      <rect
        x={RIGHT_EYE_BASE.x + ox}
        y={RIGHT_EYE_BASE.y + oy}
        width={1}
        height={1}
        fill="var(--purple)"
      />
    </svg>
  );
}

export default function MrStockBuddy({ size = 44 }: { size?: number }) {
  return (
    <div className="psl-logo">
      <div
        className="psl-logo-mark"
        style={{ width: size, height: size, background: "transparent" }}
        aria-hidden
      >
        <PixelGhost size={size} title="PURPLE STOCK SLIME" />
      </div>
      <div className="psl-logo-text">
        <span className="psl-logo-name">PURPLE STOCK SLIME</span>
      </div>
    </div>
  );
}
