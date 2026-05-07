"use client";

import { useEffect, useRef, useState } from "react";
import type { OHLCVRow } from "@/lib/api";

interface Props {
  data: OHLCVRow[];
  height?: number;
}

type Indicator = "MA5" | "MA20" | "MA60" | "BB";

function computeMA(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) =>
    i < period - 1
      ? null
      : closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
  );
}

function computeBB(closes: number[], period = 20, mult = 2) {
  const mid = computeMA(closes, period);
  const upper = closes.map((_, i) => {
    if (i < period - 1) return null;
    const slice = closes.slice(i - period + 1, i + 1);
    const m = mid[i]!;
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - m) ** 2, 0) / period);
    return m + mult * std;
  });
  const lower = closes.map((_, i) => {
    if (i < period - 1) return null;
    const slice = closes.slice(i - period + 1, i + 1);
    const m = mid[i]!;
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - m) ** 2, 0) / period);
    return m - mult * std;
  });
  return { upper, lower, mid };
}

const IND_LABELS: { key: Indicator; label: string; color: string }[] = [
  { key: "MA5",  label: "MA5",   color: "#B0883A" },
  { key: "MA20", label: "MA20",  color: "#436B95" },
  { key: "MA60", label: "MA60",  color: "#B5453F" },
  { key: "BB",   label: "볼린저", color: "#7C9BBE" },
];

export default function TradingChart({ data, height = 420 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicators, setIndicators] = useState<Set<Indicator>>(new Set(["MA20"]));

  function toggleIndicator(ind: Indicator) {
    setIndicators(prev => {
      const next = new Set(prev);
      next.has(ind) ? next.delete(ind) : next.add(ind);
      return next;
    });
  }

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    let cleanup = () => {};

    import("lightweight-charts").then((lc) => {
      const {
        createChart,
        CandlestickSeries,
        LineSeries,
        HistogramSeries,
        LineStyle,
      } = lc;

      const el = containerRef.current!;
      el.innerHTML = "";

      const chart = createChart(el, {
        width: el.clientWidth,
        height,
        layout: {
          background: { color: "#F1ECDF" },
          textColor: "#7C7264",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "#E0D8CC", style: LineStyle.Dashed },
          horzLines: { color: "#E0D8CC", style: LineStyle.Dashed },
        },
        crosshair: { mode: 1 },
        rightPriceScale: {
          borderColor: "#BCB09A",
          scaleMargins: { top: 0.08, bottom: 0.32 },
        },
        timeScale: { borderColor: "#BCB09A", timeVisible: true },
      });

      // ── 날짜를 lightweight-charts BusinessDay 문자열로 그대로 사용
      type T = string & { readonly _brand: "Time" };
      const t = (d: string) => d as T;

      // ── 캔들 시리즈 ────────────────────────────────────
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor:        "#B5453F",
        downColor:      "#436B95",
        borderUpColor:  "#B5453F",
        borderDownColor:"#436B95",
        wickUpColor:    "#B5453F",
        wickDownColor:  "#436B95",
      });
      candleSeries.setData(
        data.map(d => ({ time: t(d.date), open: d.open, high: d.high, low: d.low, close: d.close }))
      );

      const closes = data.map(d => d.close);

      // ── 헬퍼: MA 시리즈 추가 ──────────────────────────
      function addMA(period: number, color: string, width: 1 | 2 | 3 | 4 = 1) {
        const s = chart.addSeries(LineSeries, {
          color,
          lineWidth: width,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        s.setData(
          computeMA(closes, period)
            .map((v, i) => (v !== null ? { time: t(data[i].date), value: v } : null))
            .filter((x): x is { time: T; value: number } => x !== null)
        );
      }

      if (indicators.has("MA5"))  addMA(5,  "#B0883A", 1);
      if (indicators.has("MA20")) addMA(20, "#436B95", 2);
      if (indicators.has("MA60")) addMA(60, "#B5453F", 1);

      if (indicators.has("BB")) {
        const bb = computeBB(closes);
        const bbStyle = {
          color: "#7C9BBE",
          lineWidth: 1 as const,
          priceLineVisible: false,
          lastValueVisible: false,
          lineStyle: LineStyle.Dashed,
        };
        const bbU = chart.addSeries(LineSeries, bbStyle);
        const bbL = chart.addSeries(LineSeries, bbStyle);
        bbU.setData(bb.upper.map((v, i) => v !== null ? { time: t(data[i].date), value: v } : null).filter((x): x is { time: T; value: number } => x !== null));
        bbL.setData(bb.lower.map((v, i) => v !== null ? { time: t(data[i].date), value: v } : null).filter((x): x is { time: T; value: number } => x !== null));
      }

      // ── 거래량 히스토그램 ──────────────────────────────
      const volSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });
      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.75, bottom: 0 },
      });
      volSeries.setData(
        data.map(d => ({
          time: t(d.date),
          value: d.volume,
          color: d.close >= d.open ? "rgba(181,69,63,0.4)" : "rgba(67,107,149,0.4)",
        }))
      );

      chart.timeScale().fitContent();

      const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }));
      ro.observe(el);
      cleanup = () => { ro.disconnect(); chart.remove(); };
    });

    return () => cleanup();
  }, [data, indicators, height]);

  return (
    <div>
      {/* 지표 토글 */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "8px", flexWrap: "wrap" }}>
        {IND_LABELS.map(({ key, label, color }) => {
          const on = indicators.has(key);
          return (
            <button
              key={key}
              onClick={() => toggleIndicator(key)}
              style={{
                padding: "3px 10px",
                fontSize: "0.72rem",
                fontFamily: "var(--mono)",
                fontWeight: 700,
                background: on ? `${color}22` : "transparent",
                color: on ? color : "var(--muted)",
                border: `1px solid ${on ? color : "var(--border)"}`,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* 차트 컨테이너 */}
      <div ref={containerRef} style={{ width: "100%", height: `${height}px` }} />
    </div>
  );
}
