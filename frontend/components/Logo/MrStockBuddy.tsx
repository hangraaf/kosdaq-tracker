"use client";

/**
 * PURPLE STOCK SLIME — 픽셀 고스트 마스코트 + 워드마크
 * 컴포넌트 이름은 레거시 호환을 위해 유지.
 *
 * 14×14 픽셀 그리드를 인라인 SVG로 직접 코딩.
 *   '#' = 바디 (퍼플)
 *   'O' = 눈 외곽 (흰색)
 *   '.' = 투명
 *  눈 동공은 'O' 사이에 '#'을 박아 바디 색으로 hollow 효과.
 */
const GHOST_GRID = [
  "....######....",
  "..##########..",
  ".############.",
  "##############",
  "##OOO####OOO##",
  "##O#O####O#O##",
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

interface Cell { x: number; y: number; kind: "body" | "eye" }

const CELLS: Cell[] = (() => {
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

function PixelGhost({ size, title }: { size: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${COLS} ${ROWS}`}
      shapeRendering="crispEdges"
      role={title ? "img" : "presentation"}
      aria-label={title}
      style={{ display: "block" }}
    >
      {CELLS.map(({ x, y, kind }, i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width={1}
          height={1}
          fill={kind === "body" ? "var(--purple)" : "#ffffff"}
        />
      ))}
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
