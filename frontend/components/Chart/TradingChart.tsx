"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { OHLCVRow } from "@/lib/api";

// SSR 비활성화 (Plotly는 브라우저 전용)
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

function ema(arr: number[], n: number): number[] {
  const k = 2 / (n + 1);
  const out: number[] = [];
  for (let i = 0; i < arr.length; i++) {
    if (i === 0) { out.push(arr[0]); continue; }
    out.push(arr[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

function macdCalc(closes: number[]) {
  const fast   = ema(closes, 12);
  const slow   = ema(closes, 26);
  const line   = fast.map((v, i) => v - slow[i]);
  const signal = ema(line, 9);
  const hist   = line.map((v, i) => v - signal[i]);
  return { line, signal, hist };
}

function rsiCalc(closes: number[], n = 14): (number | null)[] {
  const out: (number | null)[] = Array(n).fill(null);
  for (let i = n; i < closes.length; i++) {
    let gain = 0, loss = 0;
    for (let j = i - n + 1; j <= i; j++) {
      const d = closes[j] - closes[j - 1];
      if (d >= 0) gain += d; else loss -= d;
    }
    const rs = loss === 0 ? 100 : gain / loss;
    out.push(100 - 100 / (1 + rs));
  }
  return out;
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

// ── 색상 ─────────────────────────────────────────────────────────────────

const C = {
  red:     "#B5453F",
  blue:    "#436B95",
  gold:    "#B0883A",
  blueSoft:"#6B8AAE",
  blueDark:"#2C4A6E",
  bg:      "rgba(253,250,244,1)",
  paper:   "rgba(248,244,235,1)",
  grid:    "#E8E1D0",
};

type ToggleKey = "ma5" | "ma20" | "ma60" | "bb" | "cross";

const TOGGLES: { key: ToggleKey; label: string; color: string }[] = [
  { key: "ma5",   label: "MA5",    color: C.gold },
  { key: "ma20",  label: "MA20",   color: C.blueSoft },
  { key: "ma60",  label: "MA60",   color: C.blueDark },
  { key: "bb",    label: "볼린저",  color: C.blueSoft },
  { key: "cross", label: "크로스",  color: C.gold },
];

export default function TradingChart({ data }: Props) {
  const [show, setShow] = useState<Record<ToggleKey, boolean>>({
    ma5: true, ma20: true, ma60: false, bb: false, cross: true,
  });

  const toggle = (k: ToggleKey) => setShow(p => ({ ...p, [k]: !p[k] }));

  const traces = useMemo(() => {
    if (!data.length) return [];
    const dates  = data.map(d => d.date);
    const closes = data.map(d => d.close);
    const opens  = data.map(d => d.open);
    const highs  = data.map(d => d.high);
    const lows   = data.map(d => d.low);
    const vols   = data.map(d => d.volume);

    const ma5v  = ma(closes, 5);
    const ma20v = ma(closes, 20);
    const ma60v = ma(closes, 60);
    const bb    = bollingerBands(closes);
    const { line: macdLine, signal: macdSig, hist: macdHist } = macdCalc(closes);
    const rsiV  = rsiCalc(closes);
    const { golden, dead } = detectCrosses(ma5v, ma20v, dates);

    const volColors = closes.map((c, i) => c >= opens[i] ? "rgba(181,69,63,0.55)" : "rgba(67,107,149,0.55)");
    const macdColors = macdHist.map(v => v >= 0 ? "rgba(181,69,63,0.7)" : "rgba(67,107,149,0.7)");

    const out: Plotly.Data[] = [];

    // ── 볼린저밴드 fill ──────────────────────────────
    if (show.bb) {
      out.push({
        x: [...dates, ...dates.slice().reverse()],
        y: [...bb.map(b => b.upper), ...bb.slice().reverse().map(b => b.lower)],
        fill: "toself", fillcolor: "rgba(67,107,149,0.06)",
        line: { color: "rgba(0,0,0,0)" },
        hoverinfo: "skip", name: "볼린저밴드",
        type: "scatter", yaxis: "y",
      } as Plotly.Data);
      out.push({
        x: dates, y: bb.map(b => b.upper), name: "BB상단",
        line: { color: C.blueSoft, width: 0.8, dash: "dot" }, opacity: 0.65,
        mode: "lines", type: "scatter", yaxis: "y",
        hovertemplate: "<b>BB상단</b><br>%{x}<br>%{y:,.0f}원<extra></extra>",
      } as Plotly.Data);
      out.push({
        x: dates, y: bb.map(b => b.lower), name: "BB하단",
        line: { color: C.blueSoft, width: 0.8, dash: "dot" }, opacity: 0.65,
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
      line: { color: C.gold, width: 1.5 }, mode: "lines", type: "scatter", yaxis: "y",
      hovertemplate: "<b>MA5</b> %{y:,.0f}원<extra></extra>",
    } as Plotly.Data);

    if (show.ma20) out.push({
      x: dates, y: ma20v, name: "MA20",
      line: { color: C.blueSoft, width: 1.5 }, mode: "lines", type: "scatter", yaxis: "y",
      hovertemplate: "<b>MA20</b> %{y:,.0f}원<extra></extra>",
    } as Plotly.Data);

    if (show.ma60) out.push({
      x: dates, y: ma60v, name: "MA60",
      line: { color: C.blueDark, width: 1.5 }, mode: "lines", type: "scatter", yaxis: "y",
      hovertemplate: "<b>MA60</b> %{y:,.0f}원<extra></extra>",
    } as Plotly.Data);

    // ── 골든/데드크로스 마커 ──────────────────────────
    if (show.cross && (show.ma5 || show.ma20)) {
      if (golden.length > 0) out.push({
        x: golden.map(g => g.x), y: golden.map(g => g.y),
        mode: "text+markers",
        marker: { symbol: "triangle-up", size: 14, color: C.gold },
        text: golden.map(() => "골든크로스"),
        textposition: "bottom center",
        textfont: { size: 9, color: C.gold },
        name: "골든크로스",
        type: "scatter", yaxis: "y",
        hovertemplate: "<b>🟡 골든크로스</b><br>%{x}<br>MA5↑MA20 — 단기 상승 전환 신호<extra></extra>",
      } as Plotly.Data);

      if (dead.length > 0) out.push({
        x: dead.map(d => d.x), y: dead.map(d => d.y),
        mode: "text+markers",
        marker: { symbol: "triangle-down", size: 14, color: C.blueDark },
        text: dead.map(() => "데드크로스"),
        textposition: "top center",
        textfont: { size: 9, color: C.blueDark },
        name: "데드크로스",
        type: "scatter", yaxis: "y",
        hovertemplate: "<b>🔵 데드크로스</b><br>%{x}<br>MA5↓MA20 — 단기 하락 전환 신호<extra></extra>",
      } as Plotly.Data);
    }

    // ── 거래량 ──────────────────────────────────────
    out.push({
      x: dates, y: vols, name: "거래량",
      type: "bar", yaxis: "y2",
      marker: { color: volColors },
      hovertemplate: "<b>거래량</b><br>%{x}<br>%{y:,.0f}주<extra></extra>",
    } as Plotly.Data);

    // ── MACD ─────────────────────────────────────────
    out.push({
      x: dates, y: macdHist, name: "MACD 막대",
      type: "bar", yaxis: "y3",
      marker: { color: macdColors },
      hovertemplate: "<b>MACD 막대</b><br>%{x}<br>%{y:.2f}<extra></extra>",
    } as Plotly.Data);
    out.push({
      x: dates, y: macdLine, name: "MACD선",
      mode: "lines", type: "scatter", yaxis: "y3",
      line: { color: C.blueSoft, width: 1.5 },
      hovertemplate: "<b>MACD선</b> %{y:.2f}<extra></extra>",
    } as Plotly.Data);
    out.push({
      x: dates, y: macdSig, name: "시그널선",
      mode: "lines", type: "scatter", yaxis: "y3",
      line: { color: C.red, width: 1.5 },
      hovertemplate: "<b>시그널선</b> %{y:.2f}<extra></extra>",
    } as Plotly.Data);

    // ── RSI ─────────────────────────────────────────
    out.push({
      x: dates, y: rsiV, name: "RSI(14)",
      mode: "lines", type: "scatter", yaxis: "y4",
      line: { color: C.gold, width: 1.8 },
      hovertemplate: "<b>RSI</b> %{y:.1f}<extra></extra>",
    } as Plotly.Data);

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

    return {
      height: 780,
      margin: { l: 10, r: 65, t: 10, b: 30 },
      paper_bgcolor: C.paper,
      plot_bgcolor:  C.bg,
      font: { color: "#3D3830", family: "Pretendard, sans-serif", size: 11 },
      showlegend: false,
      xaxis: {
        domain: [0, 1], anchor: "y",
        showgrid: false, gridcolor: C.grid,
        rangeslider: { visible: false },
        type: "date",
        rangebreaks: [{ bounds: ["sat", "mon"] }],
        tickfont: { size: 10 },
      },
      // y1: 가격 (52%)
      yaxis: {
        domain: [0.48, 1], anchor: "x",
        gridcolor: C.grid, tickformat: ",",
        side: "right", tickfont: { size: 10 },
      },
      // y2: 거래량 (16%)
      yaxis2: {
        domain: [0.32, 0.47], anchor: "x",
        gridcolor: C.grid, tickformat: ".2s",
        side: "right", tickfont: { size: 9 },
      },
      // y3: MACD (16%)
      yaxis3: {
        domain: [0.16, 0.31], anchor: "x",
        gridcolor: C.grid,
        side: "right", tickfont: { size: 9 },
        zeroline: true, zerolinecolor: "rgba(255,255,255,0.25)",
      },
      // y4: RSI (16%)
      yaxis4: {
        domain: [0, 0.15], anchor: "x",
        gridcolor: C.grid, range: [0, 100],
        side: "right", tickfont: { size: 9 },
      },
      hoverlabel: { bgcolor: "#FFF", font: { size: 12, color: "#1C1916" }, namelength: -1 },
      dragmode: "zoom",
      // 현재가 / 기간 고·저 수평선
      shapes: [
        // 현재가
        { type: "line", x0: dates[0], x1: dates[dates.length - 1], y0: last, y1: last,
          xref: "x", yref: "y",
          line: { color: C.gold, width: 1.3, dash: "dash" } },
        // 기간 최고가
        { type: "line", x0: dates[0], x1: dates[dates.length - 1], y0: high, y1: high,
          xref: "x", yref: "y",
          line: { color: C.red, width: 1, dash: "dot" } },
        // 기간 최저가
        { type: "line", x0: dates[0], x1: dates[dates.length - 1], y0: low, y1: low,
          xref: "x", yref: "y",
          line: { color: C.blue, width: 1, dash: "dot" } },
        // RSI 70
        { type: "rect", x0: dates[0], x1: dates[dates.length - 1], y0: 70, y1: 100,
          xref: "x", yref: "y4",
          fillcolor: "rgba(181,69,63,0.10)", line: { width: 0 } },
        // RSI 30
        { type: "rect", x0: dates[0], x1: dates[dates.length - 1], y0: 0, y1: 30,
          xref: "x", yref: "y4",
          fillcolor: "rgba(67,107,149,0.10)", line: { width: 0 } },
        // MACD 제로선
        { type: "line", x0: dates[0], x1: dates[dates.length - 1], y0: 0, y1: 0,
          xref: "x", yref: "y3",
          line: { color: "rgba(255,255,255,0.25)", width: 1 } },
      ],
      annotations: [
        // 현재가 라벨
        { xref: "paper", yref: "y", x: 1.01, y: last, xanchor: "left", yanchor: "middle",
          text: `<b>${last.toLocaleString()}</b>`, showarrow: false,
          font: { size: 11, color: C.gold }, bgcolor: C.paper,
          bordercolor: C.gold, borderwidth: 1, borderpad: 3 },
        // 기간 최고가 라벨
        { xref: "paper", yref: "y", x: 0.01, y: high, xanchor: "left", yanchor: "bottom",
          text: `  기간최고 ${high.toLocaleString()} (${pctH > 0 ? "+" : ""}${pctH.toFixed(1)}%)  `,
          showarrow: false, font: { size: 10, color: C.red },
          bgcolor: "rgba(253,250,244,0.88)", bordercolor: C.red, borderwidth: 1, borderpad: 3 },
        // 기간 최저가 라벨
        { xref: "paper", yref: "y", x: 0.01, y: low, xanchor: "left", yanchor: "top",
          text: `  기간최저 ${low.toLocaleString()} (${pctL.toFixed(1)}%)  `,
          showarrow: false, font: { size: 10, color: C.blue },
          bgcolor: "rgba(253,250,244,0.88)", bordercolor: C.blue, borderwidth: 1, borderpad: 3 },
        // 거래량 레이블
        { xref: "paper", yref: "y2 domain", x: 0.01, y: 0.98, xanchor: "left", yanchor: "top",
          text: "📊 거래량", showarrow: false, font: { size: 10, color: "#7C7264" } },
        // MACD 레이블
        { xref: "paper", yref: "y3 domain", x: 0.01, y: 0.98, xanchor: "left", yanchor: "top",
          text: "📉 MACD(12,26,9)  막대 빨강=매수세 / 파랑=매도세", showarrow: false,
          font: { size: 9, color: "#7C7264" } },
        // RSI 레이블
        { xref: "paper", yref: "y4 domain", x: 0.01, y: 0.98, xanchor: "left", yanchor: "top",
          text: "⚡ RSI(14)  70↑ 과매수 · 30↓ 과매도", showarrow: false,
          font: { size: 9, color: "#7C7264" } },
        // RSI 70 선 레이블
        { xref: "paper", yref: "y4", x: 1.01, y: 70, xanchor: "left", yanchor: "middle",
          text: "70", showarrow: false, font: { size: 9, color: C.red } },
        // RSI 30 선 레이블
        { xref: "paper", yref: "y4", x: 1.01, y: 30, xanchor: "left", yanchor: "middle",
          text: "30", showarrow: false, font: { size: 9, color: C.blue } },
      ],
    };
  }, [data]);

  if (!data.length) {
    return <div style={{ height: 780, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>차트 데이터 없음</div>;
  }

  return (
    <div>
      {/* ── 지표 토글 ─────────────────────────────── */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "8px", flexWrap: "wrap", alignItems: "center" }}>
        {TOGGLES.map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            style={{
              padding: "4px 12px",
              fontSize: "0.75rem",
              fontFamily: "var(--mono)",
              fontWeight: 700,
              background: show[key] ? `${color}28` : "transparent",
              color: show[key] ? color : "var(--muted)",
              border: `2px solid ${show[key] ? color : "var(--border)"}`,
              cursor: "pointer",
              transition: "all 0.12s",
              letterSpacing: "0.03em",
            }}
          >
            {label}
          </button>
        ))}
        <span style={{ fontSize: "0.68rem", color: "var(--muted)", marginLeft: "6px" }}>
          🔴 양봉(상승)&nbsp; 🔵 음봉(하락)&nbsp;·&nbsp; 차트를 드래그해 확대, 더블클릭으로 초기화
        </span>
      </div>

      {/* ── Plotly 차트 ───────────────────────────── */}
      <div style={{ minHeight: "780px" }}>
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
          style={{ width: "100%", height: "780px" }}
          useResizeHandler
        />
      </div>

      {/* ── Bauhaus 범례 ──────────────────────────── */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "10px 20px",
        padding: "8px 12px",
        background: "#EDE8DC",
        border: "1px solid var(--border)",
        borderTop: "none",
        fontSize: "0.7rem",
        color: "var(--muted)",
        fontFamily: "var(--font)",
        overflowX: "auto",
      }}>
        <span><b style={{ color: C.gold }}>━</b> 현재가</span>
        <span><b style={{ color: C.red }}>┅</b> 기간최고</span>
        <span><b style={{ color: C.blue }}>┅</b> 기간최저</span>
        {show.ma5  && <span><b style={{ color: C.gold }}>━</b> MA5 (5일 단기)</span>}
        {show.ma20 && <span><b style={{ color: C.blueSoft }}>━</b> MA20 (20일 중기)</span>}
        {show.ma60 && <span><b style={{ color: C.blueDark }}>━</b> MA60 (60일 장기)</span>}
        {show.cross && <span><b style={{ color: C.gold }}>▲</b> 골든크로스 (매수신호)</span>}
        {show.cross && <span><b style={{ color: C.blueDark }}>▼</b> 데드크로스 (매도신호)</span>}
        {show.bb   && <span><b style={{ color: C.blueSoft }}>┄</b> 볼린저밴드 (상단↑과매수 / 하단↓과매도)</span>}
      </div>
    </div>
  );
}
