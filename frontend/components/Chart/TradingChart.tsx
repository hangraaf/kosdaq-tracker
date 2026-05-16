"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { OHLCVRow } from "@/lib/api";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface Props {
  data: OHLCVRow[];
}

// ── 지표 계산 ─────────────────────────────────────────────────────────────

function ma(arr: number[], n: number): (number | null)[] {
  return arr.map((_, i) =>
    i < n - 1 ? null : arr.slice(i - n + 1, i + 1).reduce((a, b) => a + b) / n
  );
}

function bollingerBands(closes: number[], n = 20, mult = 2) {
  const mid = ma(closes, n);
  return closes.map((_, i) => {
    if (mid[i] === null) return { upper: null, mid: null, lower: null };
    const sl = closes.slice(i - n + 1, i + 1);
    const m  = mid[i]!;
    const std = Math.sqrt(sl.reduce((s, v) => s + (v - m) ** 2, 0) / n);
    return { upper: m + mult * std, mid: m, lower: m - mult * std };
  });
}

function detectCrosses(ma5: (number | null)[], ma20: (number | null)[], dates: string[]) {
  const golden: { x: string; y: number }[] = [];
  const dead:   { x: string; y: number }[] = [];
  for (let i = 1; i < ma5.length; i++) {
    const p5 = ma5[i - 1], p20 = ma20[i - 1], c5 = ma5[i], c20 = ma20[i];
    if (p5 === null || p20 === null || c5 === null || c20 === null) continue;
    if (p5 < p20 && c5 >= c20) golden.push({ x: dates[i], y: c5 });
    if (p5 > p20 && c5 <= c20) dead.push({ x: dates[i], y: c5 });
  }
  return { golden, dead };
}

// 누적 VWAP — 시작점부터 i시점까지의 거래대금 가중평균
function cumulativeVWAP(rows: OHLCVRow[]): number[] {
  const out: number[] = [];
  let pv = 0, v = 0;
  for (const d of rows) {
    const typical = (d.high + d.low + d.close) / 3;
    pv += typical * d.volume;
    v  += d.volume;
    out.push(v > 0 ? pv / v : d.close);
  }
  return out;
}

// 가격대별 거래대금 프로파일 (Volume Profile)
// 가격 범위를 nBins로 분할해 각 일별 거래대금을 typical price 기준 bin에 누적
function volumeProfile(rows: OHLCVRow[], nBins = 30): { binMid: number[]; amount: number[]; pocIdx: number } {
  if (rows.length === 0) return { binMid: [], amount: [], pocIdx: -1 };
  const lo = Math.min(...rows.map(d => d.low));
  const hi = Math.max(...rows.map(d => d.high));
  const step = (hi - lo) / nBins || 1;
  const amount = new Array(nBins).fill(0);
  for (const d of rows) {
    const typical = (d.high + d.low + d.close) / 3;
    const idx = Math.min(nBins - 1, Math.max(0, Math.floor((typical - lo) / step)));
    amount[idx] += d.close * d.volume;
  }
  const binMid = amount.map((_, i) => lo + step * (i + 0.5));
  let pocIdx = 0, max = -Infinity;
  for (let i = 0; i < amount.length; i++) if (amount[i] > max) { max = amount[i]; pocIdx = i; }
  return { binMid, amount, pocIdx };
}

// ── 컬러 (퍼플 슬라임) ────────────────────────────────────────────────────

const C = {
  red:         "#B5453F",                      // 양봉/상승
  blue:        "#436B95",                      // 음봉/하락
  purple:      "#7132f5",                      // 브랜드 — VWAP, 1순위 시그널
  purpleDeep:  "#5b1ecf",                      // 강조 — POC, 자금유입 강세
  purpleSoft:  "rgba(113,50,245,0.55)",        // 중간 강도
  purplePale:  "rgba(133,91,251,0.16)",        // 약한 강도
  ink:         "#101114",
  inkMuted:    "#686b82",
  inkSoft:     "#9497a9",
  surface:     "#ffffff",
  surface2:    "#f8f9fb",
  line:        "#dedee5",
  grid:        "#eef0f4",
};

type ToggleKey = "ma5" | "ma20" | "ma60" | "bb" | "cross" | "vwap" | "vprof";

const TOGGLES: { key: ToggleKey; label: string; color: string }[] = [
  { key: "ma5",   label: "MA5",    color: C.inkSoft },
  { key: "ma20",  label: "MA20",   color: C.blue },
  { key: "ma60",  label: "MA60",   color: C.ink },
  { key: "bb",    label: "볼린저",  color: C.blue },
  { key: "cross", label: "크로스",  color: C.purple },
  { key: "vwap",  label: "VWAP",   color: C.purpleDeep },
  { key: "vprof", label: "수급분포", color: C.purpleDeep },
];

export default function TradingChart({ data }: Props) {
  const [show, setShow] = useState<Record<ToggleKey, boolean>>({
    ma5: true, ma20: true, ma60: false, bb: false, cross: true,
    vwap: true, vprof: true,
  });

  const toggle = (k: ToggleKey) => setShow(p => ({ ...p, [k]: !p[k] }));

  const traces = useMemo(() => {
    if (!data.length) return [];
    const dates  = data.map(d => d.date);
    const closes = data.map(d => d.close);
    const opens  = data.map(d => d.open);
    const highs  = data.map(d => d.high);
    const lows   = data.map(d => d.low);
    const amounts = data.map(d => d.close * d.volume);

    const ma5v  = ma(closes, 5);
    const ma20v = ma(closes, 20);
    const ma60v = ma(closes, 60);
    const bb    = bollingerBands(closes);
    const vwapArr = cumulativeVWAP(data);
    const { golden, dead } = detectCrosses(ma5v, ma20v, dates);

    // 거래대금 농도 — 20일 평균 대비 배수로 그라데이션
    const avg20 = amounts.map((_, i) =>
      i < 19 ? null : amounts.slice(i - 19, i + 1).reduce((a, b) => a + b, 0) / 20
    );
    const amtColors = amounts.map((a, i) => {
      const av = avg20[i];
      if (av == null || av === 0) return C.purplePale;
      const r = a / av;
      if (r >= 2.0) return C.purpleDeep;
      if (r >= 1.3) return C.purple;
      if (r >= 0.7) return C.purpleSoft;
      return C.purplePale;
    });

    const out: Plotly.Data[] = [];

    // ── 볼린저밴드 ──────────────────────────────────
    if (show.bb) {
      out.push({
        x: [...dates, ...dates.slice().reverse()],
        y: [...bb.map(b => b.upper), ...bb.slice().reverse().map(b => b.lower)],
        fill: "toself", fillcolor: "rgba(67,107,149,0.05)",
        line: { color: "rgba(0,0,0,0)" },
        hoverinfo: "skip", name: "볼린저밴드",
        type: "scatter", yaxis: "y",
      } as Plotly.Data);
      out.push({
        x: dates, y: bb.map(b => b.upper), name: "BB상단",
        line: { color: C.blue, width: 0.8, dash: "dot" }, opacity: 0.55,
        mode: "lines", type: "scatter", yaxis: "y",
        hovertemplate: "<b>BB상단</b><br>%{x}<br>%{y:,.0f}원<extra></extra>",
      } as Plotly.Data);
      out.push({
        x: dates, y: bb.map(b => b.lower), name: "BB하단",
        line: { color: C.blue, width: 0.8, dash: "dot" }, opacity: 0.55,
        mode: "lines", type: "scatter", yaxis: "y",
        hovertemplate: "<b>BB하단</b><br>%{x}<br>%{y:,.0f}원<extra></extra>",
      } as Plotly.Data);
    }

    // ── 캔들스틱 ────────────────────────────────────
    out.push({
      type: "candlestick",
      x: dates, open: opens, high: highs, low: lows, close: closes,
      name: "캔들",
      increasing: { line: { color: C.red }, fillcolor: C.red },
      decreasing: { line: { color: C.blue }, fillcolor: C.blue },
      yaxis: "y",
      hovertemplate:
        "<b>%{x}</b><br>" +
        "시가: %{open:,.0f}원<br>고가: %{high:,.0f}원<br>" +
        "저가: %{low:,.0f}원<br>종가: %{close:,.0f}원<extra></extra>",
    } as Plotly.Data);

    // ── 이동평균선 ───────────────────────────────────
    if (show.ma5) out.push({
      x: dates, y: ma5v, name: "MA5",
      line: { color: C.inkSoft, width: 1.4 }, mode: "lines", type: "scatter", yaxis: "y",
      hovertemplate: "<b>MA5</b> %{y:,.0f}원<extra></extra>",
    } as Plotly.Data);
    if (show.ma20) out.push({
      x: dates, y: ma20v, name: "MA20",
      line: { color: C.blue, width: 1.4 }, mode: "lines", type: "scatter", yaxis: "y",
      hovertemplate: "<b>MA20</b> %{y:,.0f}원<extra></extra>",
    } as Plotly.Data);
    if (show.ma60) out.push({
      x: dates, y: ma60v, name: "MA60",
      line: { color: C.ink, width: 1.4 }, mode: "lines", type: "scatter", yaxis: "y",
      hovertemplate: "<b>MA60</b> %{y:,.0f}원<extra></extra>",
    } as Plotly.Data);

    // ── VWAP (누적) ─────────────────────────────────
    if (show.vwap) out.push({
      x: dates, y: vwapArr, name: "VWAP",
      line: { color: C.purpleDeep, width: 1.8, dash: "dash" },
      mode: "lines", type: "scatter", yaxis: "y",
      hovertemplate: "<b>VWAP</b> %{y:,.0f}원<extra></extra>",
    } as Plotly.Data);

    // ── 골든/데드크로스 마커 ──────────────────────────
    if (show.cross && (show.ma5 || show.ma20)) {
      if (golden.length > 0) out.push({
        x: golden.map(g => g.x), y: golden.map(g => g.y),
        mode: "text+markers",
        marker: { symbol: "triangle-up", size: 13, color: C.purple },
        text: golden.map(() => "골든"),
        textposition: "bottom center",
        textfont: { size: 9, color: C.purple },
        name: "골든크로스",
        type: "scatter", yaxis: "y",
        hovertemplate: "<b>골든크로스</b><br>%{x}<br>MA5↑MA20 — 단기 상승 전환 신호<extra></extra>",
      } as Plotly.Data);
      if (dead.length > 0) out.push({
        x: dead.map(d => d.x), y: dead.map(d => d.y),
        mode: "text+markers",
        marker: { symbol: "triangle-down", size: 13, color: C.blue },
        text: dead.map(() => "데드"),
        textposition: "top center",
        textfont: { size: 9, color: C.blue },
        name: "데드크로스",
        type: "scatter", yaxis: "y",
        hovertemplate: "<b>데드크로스</b><br>%{x}<br>MA5↓MA20 — 단기 하락 전환 신호<extra></extra>",
      } as Plotly.Data);
    }

    // ── 거래대금 바 (농도 그라데이션) ────────────────
    out.push({
      x: dates, y: amounts, name: "거래대금",
      type: "bar", yaxis: "y2",
      marker: { color: amtColors },
      hovertemplate: "<b>거래대금</b><br>%{x}<br>%{y:,.0f}원<extra></extra>",
    } as Plotly.Data);

    // ── Volume Profile (우측 horizontal bar, 가격 y 공유) ──
    if (show.vprof) {
      const { binMid, amount, pocIdx } = volumeProfile(data, 30);
      const vpColors = amount.map((_, i) => i === pocIdx ? C.purpleDeep : C.purplePale);
      out.push({
        x: amount, y: binMid, name: "수급분포",
        type: "bar", orientation: "h",
        xaxis: "x2", yaxis: "y",
        marker: { color: vpColors, line: { width: 0 } },
        hovertemplate: "<b>수급분포</b><br>가격대: %{y:,.0f}원<br>거래대금: %{x:,.0f}<extra></extra>",
        showlegend: false,
      } as Plotly.Data);
    }

    return out;
  }, [data, show]);

  const layout = useMemo((): Partial<Plotly.Layout> => {
    if (!data.length) return {};
    const dates  = data.map(d => d.date);
    const closes = data.map(d => d.close);
    const last   = closes[closes.length - 1] ?? 0;
    const high   = Math.max(...data.map(d => d.high));
    const low    = Math.min(...data.map(d => d.low));
    const pctH   = ((high / last) - 1) * 100;
    const pctL   = ((low  / last) - 1) * 100;

    // Volume Profile을 우측에 두면 메인 차트 x 도메인을 좁힘
    const mainXEnd = show.vprof ? 0.86 : 1;

    return {
      height: 560,
      margin: { l: 10, r: 65, t: 10, b: 30 },
      paper_bgcolor: C.surface,
      plot_bgcolor:  C.surface,
      font: { color: C.ink, family: "var(--font, 'MaruBuri', sans-serif)", size: 11 },
      showlegend: false,
      xaxis: {
        domain: [0, mainXEnd], anchor: "y",
        showgrid: false, gridcolor: C.grid,
        rangeslider: { visible: false },
        type: "date",
        rangebreaks: [{ bounds: ["sat", "mon"] }],
        tickfont: { size: 10, color: C.inkMuted },
      },
      // 우측 Volume Profile용 x축 (가격 y를 공유)
      xaxis2: {
        domain: [mainXEnd + 0.01, 1], anchor: "y",
        showgrid: false, showticklabels: false,
        zeroline: false, fixedrange: true,
      },
      // y1: 가격 (75%)
      yaxis: {
        domain: [0.26, 1], anchor: "x",
        gridcolor: C.grid, tickformat: ",",
        side: "right", tickfont: { size: 10, color: C.inkMuted },
      },
      // y2: 거래대금 (24%)
      yaxis2: {
        domain: [0, 0.24], anchor: "x",
        gridcolor: C.grid, tickformat: ".2s",
        side: "right", tickfont: { size: 9, color: C.inkMuted },
      },
      hoverlabel: { bgcolor: C.surface, font: { size: 12, color: C.ink }, namelength: -1 },
      dragmode: "zoom",
      shapes: [
        // 현재가 가로선
        { type: "line", x0: dates[0], x1: dates[dates.length - 1], y0: last, y1: last,
          xref: "x", yref: "y",
          line: { color: C.purple, width: 1.2, dash: "dash" } },
        // 기간 최고/최저
        { type: "line", x0: dates[0], x1: dates[dates.length - 1], y0: high, y1: high,
          xref: "x", yref: "y", line: { color: C.red, width: 1, dash: "dot" } },
        { type: "line", x0: dates[0], x1: dates[dates.length - 1], y0: low, y1: low,
          xref: "x", yref: "y", line: { color: C.blue, width: 1, dash: "dot" } },
      ],
      annotations: [
        // 현재가 라벨
        { xref: "paper", yref: "y", x: 1.01, y: last, xanchor: "left", yanchor: "middle",
          text: `<b>${last.toLocaleString()}</b>`, showarrow: false,
          font: { size: 11, color: "#ffffff" }, bgcolor: C.purple,
          bordercolor: C.purple, borderwidth: 1, borderpad: 3 },
        // 기간 최고
        { xref: "paper", yref: "y", x: 0.01, y: high, xanchor: "left", yanchor: "bottom",
          text: `  기간최고 ${high.toLocaleString()} (${pctH > 0 ? "+" : ""}${pctH.toFixed(1)}%)  `,
          showarrow: false, font: { size: 10, color: C.red },
          bgcolor: "rgba(255,255,255,0.9)", bordercolor: C.red, borderwidth: 1, borderpad: 3 },
        // 기간 최저
        { xref: "paper", yref: "y", x: 0.01, y: low, xanchor: "left", yanchor: "top",
          text: `  기간최저 ${low.toLocaleString()} (${pctL.toFixed(1)}%)  `,
          showarrow: false, font: { size: 10, color: C.blue },
          bgcolor: "rgba(255,255,255,0.9)", bordercolor: C.blue, borderwidth: 1, borderpad: 3 },
        // 거래대금 레이블
        { xref: "paper", yref: "y2 domain", x: 0.01, y: 0.95, xanchor: "left", yanchor: "top",
          text: "거래대금 — 색이 진할수록 평균 대비 강함", showarrow: false,
          font: { size: 10, color: C.inkMuted } },
        ...(show.vprof ? [{
          xref: "paper" as const, yref: "y domain" as const,
          x: mainXEnd + 0.01, y: 1, xanchor: "left" as const, yanchor: "top" as const,
          text: "가격대별 수급", showarrow: false,
          font: { size: 9, color: C.inkMuted },
        }] : []),
      ],
    };
  }, [data, show.vprof]);

  if (!data.length) {
    return <div style={{ height: 560, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-soft)" }}>차트 데이터 없음</div>;
  }

  return (
    <div>
      {/* ── 지표 토글 ─────────────────────────────── */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap", alignItems: "center" }}>
        {TOGGLES.map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            style={{
              padding: "6px 12px",
              fontSize: "0.74rem",
              fontFamily: "var(--mono)",
              fontWeight: 600,
              background: show[key] ? C.purplePale : C.surface,
              color: show[key] ? color : C.inkSoft,
              border: `1px solid ${show[key] ? color : C.line}`,
              cursor: "pointer",
              borderRadius: "10px",
              transition: "all 160ms ease",
              letterSpacing: "0.02em",
            }}
          >
            {label}
          </button>
        ))}
        <span style={{ fontSize: "0.7rem", color: C.inkSoft, marginLeft: "8px" }}>
          드래그해 확대, 더블클릭으로 초기화
        </span>
      </div>

      {/* ── Plotly 차트 ───────────────────────────── */}
      <div style={{ minHeight: "560px" }}>
        <Plot
          data={traces}
          layout={layout}
          config={{
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ["autoScale2d", "lasso2d", "select2d", "toImage"],
            displaylogo: false,
            locale: "ko",
          }}
          style={{ width: "100%", height: "560px" }}
          useResizeHandler
        />
      </div>

      {/* ── 범례 ──────────────────────────── */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "10px 18px",
        padding: "10px 14px",
        background: C.surface2,
        border: `1px solid ${C.line}`,
        borderTop: "none",
        borderRadius: "0 0 12px 12px",
        fontSize: "0.72rem",
        color: C.inkMuted,
        fontFamily: "var(--font)",
        overflowX: "auto",
      }}>
        <span><b style={{ color: C.purple }}>━</b> 현재가</span>
        <span><b style={{ color: C.red }}>┅</b> 기간최고</span>
        <span><b style={{ color: C.blue }}>┅</b> 기간최저</span>
        {show.vwap && <span><b style={{ color: C.purpleDeep }}>┅</b> VWAP (수급 평균단가)</span>}
        {show.ma5  && <span><b style={{ color: C.inkSoft }}>━</b> MA5 (단기)</span>}
        {show.ma20 && <span><b style={{ color: C.blue }}>━</b> MA20 (중기)</span>}
        {show.ma60 && <span><b style={{ color: C.ink }}>━</b> MA60 (장기)</span>}
        {show.cross && <span><b style={{ color: C.purple }}>▲</b> 골든크로스</span>}
        {show.cross && <span><b style={{ color: C.blue }}>▼</b> 데드크로스</span>}
        {show.bb && <span><b style={{ color: C.blue }}>┄</b> 볼린저밴드</span>}
        {show.vprof && <span><b style={{ color: C.purpleDeep }}>■</b> POC (가장 거래대금 많은 가격대)</span>}
      </div>
    </div>
  );
}
