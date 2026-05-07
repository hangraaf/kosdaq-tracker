"use client";

import { useEffect, useState } from "react";
import { apiListStocks, apiSectors, apiSnapshot, type StockItem, type StockSnapshot } from "@/lib/api";
import { useUIStore } from "@/lib/store";
import TodayStocks from "@/components/Stocks/TodayStocks";

const MARKETS = ["전체", "코스피", "코스닥"];

function pct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function priceColor(v: number) {
  if (v > 0) return "var(--red)";
  if (v < 0) return "var(--blue)";
  return "var(--muted)";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "var(--maru)",
      fontSize: "0.92rem",
      fontWeight: 800,
      borderLeft: "5px solid #B82828",
      padding: "2px 0 4px 12px",
      marginBottom: "12px",
      color: "var(--fg)",
    }}>
      {children}
    </div>
  );
}

function StockRow({ item, onClick }: { item: StockSnapshot; onClick: () => void }) {
  return (
    <tr
      onClick={onClick}
      style={{ cursor: "pointer", borderBottom: "1px solid var(--border)" }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--surf2)")}
      onMouseLeave={e => (e.currentTarget.style.background = "")}
    >
      <td style={{ padding: "8px 10px", fontWeight: 600, color: "var(--fg)" }}>{item.name}</td>
      <td style={{ padding: "8px 6px", fontSize: "0.78rem", color: "var(--muted)" }}>{item.code}</td>
      <td style={{ padding: "8px 6px", fontSize: "0.75rem", color: "var(--muted)" }}>{item.market}</td>
      <td style={{ padding: "8px 6px", fontSize: "0.75rem", color: "var(--muted)" }}>{item.sector}</td>
      <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--mono)", fontWeight: 700 }}>
        {item.price.toLocaleString()}
      </td>
      <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--mono)", color: priceColor(item.change_rate) }}>
        {pct(item.change_rate)}
      </td>
      <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--mono)", fontSize: "0.8rem", color: priceColor(item.change) }}>
        {item.change >= 0 ? "+" : ""}{item.change.toLocaleString()}
      </td>
    </tr>
  );
}

export default function StocksPage() {
  const { market, setMarket, setSelectedCode, setMenu } = useUIStore();
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [sector, setSector] = useState("");
  const [q, setQ] = useState("");
  const [snapshots, setSnapshots] = useState<Record<string, StockSnapshot>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiSectors(market).then(s => setSectors(s));
    setSector("");
  }, [market]);

  useEffect(() => {
    setLoading(true);
    apiListStocks({ market, ...(sector ? { sector } : {}), ...(q ? { q } : {}) })
      .then(setStocks)
      .finally(() => setLoading(false));
  }, [market, sector, q]);

  // 스냅샷은 화면에 보이는 종목 첫 20개만
  useEffect(() => {
    const visible = stocks.slice(0, 20);
    visible.forEach(s => {
      if (!snapshots[s.code]) {
        apiSnapshot(s.code).then(snap => {
          setSnapshots(prev => ({ ...prev, [s.code]: snap }));
        });
      }
    });
  }, [stocks]);

  const handleClick = (code: string) => {
    setSelectedCode(code);
    setMenu("차트");
  };

  return (
    <div>
      <h1 style={{ fontFamily: "var(--maru)", color: "var(--blue-deep)", marginBottom: "20px" }}>
        종목 탐색
      </h1>

      {/* 오늘의 종목 */}
      <TodayStocks />

      {/* 필터 바 */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
        {MARKETS.map(m => (
          <button
            key={m}
            onClick={() => setMarket(m)}
            style={{
              padding: "6px 16px",
              background: market === m ? "var(--blue)" : "var(--surf)",
              color: market === m ? "#fff" : "var(--muted)",
              border: `1px solid ${market === m ? "var(--blue)" : "var(--border)"}`,
              fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
            }}
          >
            {m}
          </button>
        ))}
        <select
          value={sector}
          onChange={e => setSector(e.target.value)}
          style={{
            padding: "6px 12px", background: "var(--surf)", border: "1px solid var(--border)",
            color: "var(--fg)", fontSize: "0.82rem", cursor: "pointer",
          }}
        >
          <option value="">전체 업종</option>
          {sectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          placeholder="종목명 / 코드 검색"
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{
            padding: "6px 12px", background: "var(--surf)", border: "1px solid var(--border)",
            color: "var(--fg)", fontSize: "0.82rem", minWidth: "160px", outline: "none",
          }}
        />
      </div>

      {/* 테이블 */}
      <div className="bh-card" style={{ padding: 0, overflow: "hidden" }}>
        <SectionLabel>
          {market} 종목 {loading ? "..." : `(${stocks.length}개)`}
        </SectionLabel>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "var(--surf2)", borderBottom: "2px solid var(--border)" }}>
                {["종목명", "코드", "시장", "업종", "현재가", "등락률", "전일대비"].map(h => (
                  <th key={h} style={{
                    padding: "8px 10px", textAlign: h === "종목명" ? "left" : "right",
                    fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)",
                    letterSpacing: "0.05em", whiteSpace: "nowrap",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stocks.slice(0, 50).map(s => {
                const snap = snapshots[s.code];
                return snap ? (
                  <StockRow key={s.code} item={snap} onClick={() => handleClick(s.code)} />
                ) : (
                  <tr key={s.code} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td colSpan={7} style={{ padding: "8px 10px", color: "var(--muted)", fontSize: "0.8rem" }}>
                      {s.name} ({s.code}) — 로딩 중...
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
