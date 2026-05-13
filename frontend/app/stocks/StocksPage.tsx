"use client";

import { useEffect, useState, useCallback } from "react";
import { apiListStocks, apiSectors, apiSnapshot, type StockItem, type StockSnapshot } from "@/lib/api";
import { useUIStore, getCachedSnap, setCachedSnap } from "@/lib/store";

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
      fontFamily: "var(--maru)", fontSize: "0.92rem", fontWeight: 800,
      borderLeft: "5px solid #B82828", padding: "2px 0 4px 12px",
      marginBottom: "12px", color: "var(--fg)",
    }}>
      {children}
    </div>
  );
}

function PriceCell({ code, snap, onLoad }: {
  code: string;
  snap: StockSnapshot | null;
  onLoad: (snap: StockSnapshot) => void;
}) {
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(() => {
    if (snap || loading) return;
    setLoading(true);
    apiSnapshot(code)
      .then(s => { setCachedSnap(code, s); onLoad(s); })
      .finally(() => setLoading(false));
  }, [code, snap, loading]);

  if (snap) {
    return (
      <>
        <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--mono)", fontWeight: 700 }}>
          {snap.price.toLocaleString()}
        </td>
        <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--mono)", color: priceColor(snap.change_rate) }}>
          {pct(snap.change_rate)}
        </td>
        <td style={{ padding: "8px 8px", textAlign: "right", fontFamily: "var(--mono)", fontSize: "0.8rem", color: priceColor(snap.change) }}>
          {snap.change >= 0 ? "+" : ""}{snap.change.toLocaleString()}
        </td>
      </>
    );
  }
  return (
    <td colSpan={3} style={{ padding: "8px 10px", textAlign: "right" }}>
      <button
        onClick={e => { e.stopPropagation(); fetch(); }}
        onMouseEnter={() => fetch()}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--muted)", fontSize: "0.72rem", padding: "2px 6px",
          borderRadius: "2px",
        }}
      >
        {loading ? "조회 중..." : "시세 보기"}
      </button>
    </td>
  );
}

export default function StocksPage() {
  const { market, setMarket, setSelectedCode, setMenu } = useUIStore();
  const [stocks, setStocks]     = useState<StockItem[]>([]);
  const [sectors, setSectors]   = useState<string[]>([]);
  const [sector, setSector]     = useState("");
  const [q, setQ]               = useState("");
  const [snapshots, setSnapshots] = useState<Record<string, StockSnapshot>>({});
  const [loading, setLoading]   = useState(false);
  const [page, setPage]         = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    apiSectors(market).then(s => setSectors(s));
    setSector("");
    setPage(0);
  }, [market]);

  useEffect(() => {
    setLoading(true);
    setPage(0);
    apiListStocks({ market, ...(sector ? { sector } : {}), ...(q ? { q } : {}) })
      .then(setStocks)
      .finally(() => setLoading(false));
  }, [market, sector, q]);

  // 캐시에서 스냅샷 복원
  useEffect(() => {
    const restored: Record<string, StockSnapshot> = {};
    for (const s of stocks) {
      const cached = getCachedSnap(s.code);
      if (cached) restored[s.code] = cached;
    }
    if (Object.keys(restored).length > 0) {
      setSnapshots(prev => ({ ...prev, ...restored }));
    }
  }, [stocks]);

  const handleClick = (code: string) => {
    setSelectedCode(code);
    setMenu("차트");
  };

  const onSnapLoad = (code: string) => (snap: StockSnapshot) => {
    setSnapshots(prev => ({ ...prev, [code]: snap }));
  };

  const displayed = stocks.slice(0, (page + 1) * PAGE_SIZE);

  return (
    <div>
      <h1 style={{ fontFamily: "var(--maru)", color: "var(--blue-deep)", marginBottom: "20px" }}>
        종목 탐색
      </h1>

      {/* 필터 */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
        {MARKETS.map(m => (
          <button key={m} onClick={() => setMarket(m)} style={{
            padding: "6px 16px",
            background: market === m ? "var(--blue)" : "var(--surf)",
            color: market === m ? "#fff" : "var(--muted)",
            border: `1px solid ${market === m ? "var(--blue)" : "var(--border)"}`,
            fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
          }}>{m}</button>
        ))}
        <select value={sector} onChange={e => setSector(e.target.value)} style={{
          padding: "6px 12px", background: "var(--surf)", border: "1px solid var(--border)",
          color: "var(--fg)", fontSize: "0.82rem", cursor: "pointer",
        }}>
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

      {/* 안내 배너 */}
      <div style={{
        padding: "7px 12px", background: "#F5F0E6", border: "1px solid var(--border)",
        borderBottom: "none", fontSize: "0.72rem", color: "var(--muted)",
      }}>
        종목 행에 마우스를 올리면 시세를 조회합니다. 클릭하면 차트로 이동합니다.
      </div>

      <div className="bh-card" style={{ padding: 0, overflow: "hidden" }}>
        <SectionLabel>
          {market} 종목 {loading ? "..." : `(${stocks.length}개)`}
        </SectionLabel>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "var(--surf2)", borderBottom: "2px solid var(--border)" }}>
                {["종목명", "코드", "업종", "현재가", "등락률", "전일대비"].map(h => (
                  <th key={h} style={{
                    padding: "8px 10px", textAlign: h === "종목명" || h === "코드" || h === "업종" ? "left" : "right",
                    fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)",
                    letterSpacing: "0.05em", whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map(s => (
                <tr
                  key={s.code}
                  onClick={() => handleClick(s.code)}
                  style={{ cursor: "pointer", borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "var(--surf2)";
                    // 호버 시 자동 시세 조회
                    if (!snapshots[s.code]) {
                      apiSnapshot(s.code).then(snap => {
                        setCachedSnap(s.code, snap);
                        setSnapshots(prev => ({ ...prev, [s.code]: snap }));
                      }).catch(() => {});
                    }
                  }}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}
                >
                  <td style={{ padding: "8px 10px", fontWeight: 600, color: "var(--fg)", whiteSpace: "nowrap" }}>
                    {s.name}
                  </td>
                  <td style={{ padding: "8px 6px", fontSize: "0.78rem", color: "var(--muted)" }}>
                    {s.code}
                  </td>
                  <td style={{ padding: "8px 6px", fontSize: "0.75rem", color: "var(--muted)" }}>
                    {s.sector}
                  </td>
                  <PriceCell
                    code={s.code}
                    snap={snapshots[s.code] ?? null}
                    onLoad={onSnapLoad(s.code)}
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 더 보기 */}
        {displayed.length < stocks.length && (
          <div style={{ padding: "12px", textAlign: "center", borderTop: "1px solid var(--border)" }}>
            <button
              onClick={() => setPage(p => p + 1)}
              style={{
                padding: "8px 24px", background: "var(--blue)", color: "#fff",
                border: "none", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
              }}
            >
              더 보기 ({displayed.length} / {stocks.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
