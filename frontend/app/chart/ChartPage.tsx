"use client";

import { useEffect, useState } from "react";
import { apiChart, apiIndicators, apiSnapshot, type Indicators, type OHLCVRow, type StockSnapshot } from "@/lib/api";
import LiveBadge from "@/components/LiveBadge";
import TradingChart from "@/components/Chart/TradingChart";
import IndicatorPanel from "@/components/Chart/IndicatorPanel";
import { useUIStore } from "@/lib/store";

const PERIODS = ["5일", "2주", "1개월", "3개월", "6개월", "1년", "2년"];

function pct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export default function ChartPage() {
  const { selectedCode, period, setPeriod } = useUIStore();
  const [snap, setSnap]     = useState<StockSnapshot | null>(null);
  const [ohlcv, setOhlcv]   = useState<OHLCVRow[]>([]);
  const [indic, setIndic]   = useState<Indicators | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedCode) return;
    setLoading(true);
    Promise.all([
      apiSnapshot(selectedCode),
      apiChart(selectedCode, period),
      apiIndicators(selectedCode, period),
    ]).then(([s, c, ind]) => {
      setSnap(s);
      setOhlcv(c.items);
      setIsLive(c.live);
      setIndic(ind);
    }).finally(() => setLoading(false));
  }, [selectedCode, period]);

  if (!selectedCode) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center", color: "var(--muted)" }}>
        <div style={{ fontSize: "2rem", marginBottom: "12px" }}>▲</div>
        <div style={{ fontFamily: "var(--maru)", fontSize: "1rem" }}>종목 탭에서 종목을 선택하면 차트가 표시됩니다.</div>
      </div>
    );
  }

  return (
    <div>
      {/* 헤더 */}
      {snap && (
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
            <h1 style={{ fontFamily: "var(--maru)", color: "var(--blue-deep)", margin: 0 }}>
              {snap.name}
            </h1>
            <span style={{ color: "var(--muted)", fontSize: "0.88rem" }}>{snap.code} · {snap.market}</span>
          </div>
          <div style={{ display: "flex", gap: "20px", marginTop: "8px", flexWrap: "wrap" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: "1.6rem", fontWeight: 700 }}>
              {snap.price.toLocaleString()}원
            </div>
            <div style={{
              fontFamily: "var(--mono)", fontSize: "1.1rem", fontWeight: 700,
              color: snap.change_rate >= 0 ? "var(--red)" : "var(--blue)",
              alignSelf: "flex-end", paddingBottom: "4px",
            }}>
              {pct(snap.change_rate)} ({snap.change >= 0 ? "+" : ""}{snap.change.toLocaleString()})
            </div>
          </div>
          {/* 지표 카드 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "8px", marginTop: "12px" }}>
            {[
              { label: "거래량", value: snap.volume.toLocaleString() },
              { label: "시가총액", value: snap.market_cap >= 1e12 ? `${(snap.market_cap / 1e12).toFixed(1)}조` : `${(snap.market_cap / 1e8).toFixed(0)}억` },
              { label: "업종", value: snap.sector },
              { label: "시장", value: snap.market },
            ].map(m => (
              <div key={m.label} className="bh-card" style={{ padding: "10px 12px" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "4px" }}>{m.label}</div>
                <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: "0.95rem" }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 기간 선택 */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "12px", flexWrap: "wrap" }}>
        {PERIODS.map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              padding: "5px 14px",
              background: period === p ? "var(--blue)" : "var(--surf)",
              color: period === p ? "#fff" : "var(--muted)",
              border: `1px solid ${period === p ? "var(--blue)" : "var(--border)"}`,
              fontWeight: 700, fontSize: "0.8rem", cursor: "pointer",
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* 캔들 차트 */}
      <div className="bh-card" style={{ padding: "12px" }}>
        {loading ? (
          <div style={{ height: "360px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
            로딩 중...
          </div>
        ) : (
          <TradingChart data={ohlcv} />
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "8px", marginTop: "6px" }}>
          <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>◈ 주황선: MA20</span>
          <LiveBadge live={isLive} />
        </div>
      </div>

      {/* RSI 패널 */}
      {indic && (
        <div className="bh-card" style={{ padding: "12px", marginTop: "8px" }}>
          <IndicatorPanel data={indic} type="RSI" height={100} />
        </div>
      )}

      {/* MACD 패널 */}
      {indic && (
        <div className="bh-card" style={{ padding: "12px", marginTop: "8px" }}>
          <IndicatorPanel data={indic} type="MACD" height={100} />
        </div>
      )}
    </div>
  );
}
