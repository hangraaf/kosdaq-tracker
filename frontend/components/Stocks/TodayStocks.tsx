"use client";

import { useEffect, useState } from "react";
import { apiTodayTopFull, type StockSnapshot } from "@/lib/api";
import { useUIStore } from "@/lib/store";

function pct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function StockCard({ item, onClick }: { item: StockSnapshot; onClick: () => void }) {
  const isUp = item.change_rate >= 0;
  const accent = isUp ? "var(--red)" : "var(--blue)";
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "12px",
        padding: "14px 16px",
        cursor: "pointer",
        minWidth: "168px",
        flex: "0 0 auto",
        transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
        boxShadow: "rgba(0,0,0,0.03) 0px 4px 16px",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = "var(--purple)";
        e.currentTarget.style.boxShadow = "rgba(113,50,245,0.12) 0px 8px 24px";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "var(--line)";
        e.currentTarget.style.boxShadow = "rgba(0,0,0,0.03) 0px 4px 16px";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{
        fontSize: "0.66rem",
        color: "var(--ink-soft)",
        letterSpacing: "0.04em",
        marginBottom: "4px",
        textTransform: "uppercase",
        fontWeight: 600,
      }}>
        {item.market} · {item.sector}
      </div>
      <div style={{
        fontFamily: "var(--maru)",
        fontWeight: 700,
        fontSize: "0.95rem",
        color: "var(--ink)",
        marginBottom: "8px",
        whiteSpace: "nowrap",
        letterSpacing: "-0.2px",
      }}>
        {item.name}
      </div>
      <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: "1.05rem", color: "var(--ink)" }}>
        {item.price.toLocaleString()}
        <span style={{ fontSize: "0.7rem", color: "var(--ink-soft)", fontWeight: 400, marginLeft: "2px" }}>원</span>
      </div>
      <div style={{
        display: "inline-block",
        marginTop: "6px",
        background: accent,
        color: "#fff",
        fontFamily: "var(--mono)",
        fontWeight: 700,
        fontSize: "0.78rem",
        padding: "2px 8px",
        borderRadius: "6px",
      }}>
        {pct(item.change_rate)}
      </div>
    </div>
  );
}

function Section({ title, accent, items, onSelect }: {
  title: string;
  accent: string;
  items: StockSnapshot[];
  onSelect: (code: string) => void;
}) {
  return (
    <div style={{ marginBottom: "24px" }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        marginBottom: "12px",
      }}>
        <span style={{
          width: "3px",
          height: "16px",
          background: accent,
          borderRadius: "2px",
        }} />
        <div style={{
          fontFamily: "var(--maru)",
          fontSize: "0.96rem",
          fontWeight: 800,
          color: "var(--ink)",
          letterSpacing: "-0.2px",
        }}>
          {title}
        </div>
      </div>
      <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "6px" }}>
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
    apiTodayTopFull("전체", 500)
      .then(res => setItems(res.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = (code: string) => {
    setSelectedCode(code);
    setMenu("차트");
  };

  if (loading) return (
    <div style={{ color: "var(--ink-muted)", padding: "20px 0", fontSize: "0.88rem" }}>
      오늘의 종목 불러오는 중...
    </div>
  );

  const top10 = [...items].sort((a, b) => b.change_rate - a.change_rate).slice(0, 10);
  const bot10 = [...items].sort((a, b) => a.change_rate - b.change_rate).slice(0, 10);
  const vol10 = [...items].sort((a, b) => b.volume - a.volume).slice(0, 10);

  return (
    <div>
      <Section title="상승률 TOP 10" accent="var(--red)" items={top10} onSelect={handleSelect} />
      <Section title="하락률 TOP 10" accent="var(--blue)" items={bot10} onSelect={handleSelect} />
      <Section title="거래량 TOP 10" accent="var(--purple)" items={vol10} onSelect={handleSelect} />
    </div>
  );
}
