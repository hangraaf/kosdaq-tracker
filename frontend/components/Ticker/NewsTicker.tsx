"use client";

import { useEffect, useState } from "react";
import { apiMarketSummary, type TickerItem } from "@/lib/api";

function fmt(price: number) {
  return price.toLocaleString("ko-KR");
}

function fmtRate(rate: number) {
  return `${rate >= 0 ? "+" : ""}${rate.toFixed(2)}%`;
}

function Item({ item }: { item: TickerItem }) {
  const up = item.change_rate > 0;
  const down = item.change_rate < 0;
  // 한국 증시 관행: 상승=빨강 / 하락=파랑 (보조 채도 톤으로)
  const color = up ? "#FF8E88" : down ? "#7BB6FF" : "#D6CDE8";
  const arrow = up ? "▲" : down ? "▼" : "─";
  const absChange = Math.abs(item.change).toLocaleString("ko-KR");

  return (
    <span
      className="inline-flex items-center gap-1 px-4"
      style={{ color, fontFamily: "var(--mono)", fontSize: "0.82rem", fontWeight: 500, whiteSpace: "nowrap" }}
    >
      <span style={{ color: "#C8BEDC" }}>{item.name}</span>
      {" "}{fmt(item.price)}
      {" "}{arrow}{absChange}
      {" "}({fmtRate(item.change_rate)})
      <span style={{ color: "rgba(133,91,251,0.45)", padding: "0 4px" }}>|</span>
    </span>
  );
}

const REFRESH_MS = 60_000; // 1분

export default function NewsTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    apiMarketSummary()
      .then(r => { setItems(r.items); setLive(r.live); setError(null); })
      .catch(err => {
        console.error("Failed to fetch stock data:", err);
        setError("API 연결 실패");
      });
  };

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const doubled = [...items, ...items];

  return (
    <div
      style={{
        background: "#1a0b3d",
        borderBottom: "1px solid var(--purple-dark)",
        overflow: "hidden",
        height: "36px",
        display: "flex",
        alignItems: "center",
      }}
    >
      {/* 왼쪽 레이블 */}
      <div
        style={{
          background: live ? "var(--purple)" : "var(--ink-muted)",
          color: "#fff",
          fontFamily: "var(--mono)",
          fontSize: "0.72rem",
          fontWeight: 700,
          letterSpacing: "0.1em",
          padding: "0 12px",
          height: "100%",
          display: "flex",
          alignItems: "center",
          whiteSpace: "nowrap",
          flexShrink: 0,
          zIndex: 1,
        }}
      >
        {live ? "LIVE" : "DEMO"}
      </div>

      {/* 스크롤 영역 */}
      <div style={{ overflow: "hidden", flex: 1, position: "relative" }}>
        {error ? (
          <div style={{ color: "#FF6B6B", fontFamily: "var(--mono)", fontSize: "0.8rem", padding: "0 16px" }}>
            {error}
          </div>
        ) : doubled.length > 0 ? (
          <div className="ticker-track">
            {doubled.map((item, i) => (
              <Item key={`${item.code}-${i}`} item={item} />
            ))}
          </div>
        ) : (
          <div style={{ color: "#4A5568", fontFamily: "var(--mono)", fontSize: "0.8rem", padding: "0 16px" }}>
            데이터 로딩 중...
          </div>
        )}
      </div>
    </div>
  );
}
