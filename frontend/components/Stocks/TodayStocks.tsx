"use client";

import { useEffect, useState } from "react";
import { apiTodayTopFull, type StockSnapshot } from "@/lib/api";
import { useUIStore } from "@/lib/store";

function pct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function StockCard({ item, onClick }: { item: StockSnapshot; onClick: () => void }) {
  const isUp = item.change_rate >= 0;
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--surf)",
        border: "1px solid var(--border)",
        borderTop: `3px solid ${isUp ? "var(--red)" : "var(--blue)"}`,
        padding: "12px 14px",
        cursor: "pointer",
        minWidth: "150px",
        flex: "0 0 auto",
        transition: "background 0.15s",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--surf2)")}
      onMouseLeave={e => (e.currentTarget.style.background = "var(--surf)")}
    >
      <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: "2px" }}>
        {item.market} · {item.sector}
      </div>
      <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--fg)", marginBottom: "6px", whiteSpace: "nowrap" }}>
        {item.name}
      </div>
      <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: "1rem", marginBottom: "2px" }}>
        {item.price.toLocaleString()}
        <span style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 400 }}>원</span>
      </div>
      <div style={{
        fontFamily: "var(--mono)", fontWeight: 700, fontSize: "0.88rem",
        color: isUp ? "var(--red)" : "var(--blue)",
      }}>
        {pct(item.change_rate)}
      </div>
    </div>
  );
}

function Section({ title, color, items, onSelect }: {
  title: string; color: string;
  items: StockSnapshot[];
  onSelect: (code: string) => void;
}) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={{
        fontFamily: "var(--maru)",
        fontSize: "0.92rem",
        fontWeight: 800,
        borderLeft: `5px solid ${color}`,
        padding: "2px 0 4px 12px",
        marginBottom: "10px",
        color: "var(--fg)",
      }}>
        {title}
      </div>
      <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
        {items.map(item => (
          <StockCard key={item.code} item={item} onClick={() => onSelect(item.code)} />
        ))}
      </div>
    </div>
  );
}

export default function TodayStocks() {
  const [items, setItems] = useState<StockSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const { setSelectedCode, setMenu } = useUIStore();

  useEffect(() => {
    apiTodayTopFull("전체", 20)
      .then(res => setItems(res.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = (code: string) => {
    setSelectedCode(code);
    setMenu("차트");
  };

  if (loading) return (
    <div style={{ color: "var(--muted)", padding: "20px 0", fontSize: "0.88rem" }}>
      오늘의 종목 불러오는 중...
    </div>
  );

  const top10  = [...items].sort((a, b) => b.change_rate - a.change_rate).slice(0, 10);
  const bot10  = [...items].sort((a, b) => a.change_rate - b.change_rate).slice(0, 10);
  const vol10  = [...items].sort((a, b) => b.volume - a.volume).slice(0, 10);

  return (
    <div>
      <Section title="▲ 상승률 TOP 10" color="var(--red)"  items={top10} onSelect={handleSelect} />
      <Section title="▼ 하락률 TOP 10" color="var(--blue)" items={bot10} onSelect={handleSelect} />
      <Section title="◈ 거래량 TOP 10" color="var(--yellow)" items={vol10} onSelect={handleSelect} />
    </div>
  );
}
