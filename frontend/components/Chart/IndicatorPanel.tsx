"use client";

import { useEffect, useRef } from "react";
import type { Indicators } from "@/lib/api";

interface Props {
  data: Indicators;
  type: "RSI" | "MACD";
  height?: number;
}

export default function IndicatorPanel({ data, type, height = 120 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.dates.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const PAD = { top: 8, right: 12, bottom: 20, left: 48 };
    const cW = W - PAD.left - PAD.right;
    const cH = H - PAD.top - PAD.bottom;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#F1ECDF";
    ctx.fillRect(0, 0, W, H);

    const n = data.dates.length;
    const xScale = (i: number) => PAD.left + (i + 0.5) * (cW / n);

    if (type === "RSI") {
      const yScale = (v: number) => PAD.top + cH - ((v - 0) / 100) * cH;

      // 그리드 & 레벨선
      [[30, "#436B95"], [50, "#BCB09A"], [70, "#B5453F"]].forEach(([level, color]) => {
        const y = yScale(level as number);
        ctx.strokeStyle = color as string;
        ctx.lineWidth = level === 50 ? 0.5 : 1;
        ctx.setLineDash(level === 50 ? [4, 4] : []);
        ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = color as string;
        ctx.font = "9px monospace";
        ctx.textAlign = "right";
        ctx.fillText(String(level), PAD.left - 4, y + 3);
      });

      // RSI 선
      ctx.strokeStyle = "#B0883A";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      data.rsi.forEach((v, i) => {
        const x = xScale(i), y = yScale(Math.min(Math.max(v, 0), 100));
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();

      // 레이블
      ctx.fillStyle = "#7C7264"; ctx.font = "9px monospace"; ctx.textAlign = "left";
      ctx.fillText("RSI(14)", PAD.left + 4, PAD.top + 10);

    } else {
      // MACD
      const vals = [...data.hist, ...data.macd, ...data.signal];
      const maxV = Math.max(...vals.map(Math.abs)) * 1.1 || 1;
      const yScale = (v: number) => PAD.top + cH / 2 - (v / maxV) * (cH / 2);
      const yZero = PAD.top + cH / 2;

      // 제로선
      ctx.strokeStyle = "#BCB09A"; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(PAD.left, yZero); ctx.lineTo(W - PAD.right, yZero); ctx.stroke();

      // 히스토그램
      const barW = Math.max(cW / n - 1, 1);
      data.hist.forEach((v, i) => {
        const x = xScale(i);
        const y = yScale(v);
        ctx.fillStyle = v >= 0 ? "rgba(181,69,63,0.5)" : "rgba(67,107,149,0.5)";
        const top = Math.min(y, yZero), h = Math.max(Math.abs(y - yZero), 1);
        ctx.fillRect(x - barW / 2, top, barW, h);
      });

      // MACD선
      ctx.strokeStyle = "#B0883A"; ctx.lineWidth = 1.5;
      ctx.beginPath();
      data.macd.forEach((v, i) => {
        i === 0 ? ctx.moveTo(xScale(i), yScale(v)) : ctx.lineTo(xScale(i), yScale(v));
      });
      ctx.stroke();

      // Signal선
      ctx.strokeStyle = "#436B95"; ctx.lineWidth = 1;
      ctx.beginPath();
      data.signal.forEach((v, i) => {
        i === 0 ? ctx.moveTo(xScale(i), yScale(v)) : ctx.lineTo(xScale(i), yScale(v));
      });
      ctx.stroke();

      ctx.fillStyle = "#7C7264"; ctx.font = "9px monospace"; ctx.textAlign = "left";
      ctx.fillText("MACD(12,26,9)", PAD.left + 4, PAD.top + 10);
    }

    // X축 날짜
    ctx.fillStyle = "#7C7264"; ctx.font = "9px monospace"; ctx.textAlign = "center";
    const step = Math.ceil(n / 5);
    data.dates.forEach((d, i) => {
      if (i % step === 0) ctx.fillText(d.slice(5), xScale(i), H - 4);
    });

  }, [data, type, height]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={height}
      style={{ width: "100%", height: `${height}px`, display: "block" }}
    />
  );
}
