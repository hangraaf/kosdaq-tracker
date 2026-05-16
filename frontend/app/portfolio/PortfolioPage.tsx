"use client";

import { useEffect, useState } from "react";
import { apiFavorites, apiPortfolio, apiRemoveFavorite, apiRemovePortfolio, type PortfolioResponse, type StockSnapshot } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

function pct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function priceColor(v: number) {
  if (v > 0) return "var(--red)";
  if (v < 0) return "var(--blue)";
  return "var(--ink-muted)";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "var(--maru)", fontSize: "0.95rem", fontWeight: 700,
      letterSpacing: "-0.2px",
      borderLeft: "3px solid var(--purple)", padding: "2px 0 4px 12px",
      marginBottom: "14px", color: "var(--ink)",
    }}>
      {children}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: "16px",
  boxShadow: "rgba(0,0,0,0.03) 0px 4px 24px",
};

const deleteBtn: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  color: "var(--ink-muted)",
  padding: "4px 10px",
  cursor: "pointer",
  fontSize: "0.74rem",
  fontWeight: 500,
  borderRadius: "8px",
};

function LoginPrompt() {
  return (
    <div style={{
      padding: "72px 24px", textAlign: "center", color: "var(--ink-muted)",
      ...cardStyle,
    }}>
      <div style={{
        fontFamily: "var(--maru)", fontSize: "1.05rem",
        color: "var(--ink)", fontWeight: 600, marginBottom: "8px",
      }}>
        로그인이 필요합니다
      </div>
      <div style={{ fontSize: "0.86rem", color: "var(--ink-soft)" }}>
        로그인하면 관심종목과 포트폴리오를 저장할 수 있습니다.
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{ padding: "48px 0", textAlign: "center", color: "var(--ink-soft)", fontFamily: "var(--maru)", fontSize: "0.92rem" }}>
      {label}
    </div>
  );
}

function FavoritesSection() {
  const [items, setItems] = useState<StockSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    apiFavorites().then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const remove = async (code: string) => {
    await apiRemoveFavorite(code);
    load();
  };

  if (loading) return <div style={{ color: "var(--ink-soft)", padding: "20px" }}>로딩 중...</div>;
  if (items.length === 0) return <EmptyState label="관심종목이 없습니다." />;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
        <thead>
          <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
            {["종목명", "현재가", "등락률", "전일대비", ""].map(h => (
              <th key={h} style={{ padding: "10px 10px", textAlign: h === "종목명" ? "left" : "right", fontSize: "0.72rem", fontWeight: 600, color: "var(--ink-muted)", letterSpacing: "0.03em" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(s => (
            <tr key={s.code} style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "10px 10px", fontWeight: 600, color: "var(--ink)" }}>{s.name} <span style={{ color: "var(--ink-soft)", fontSize: "0.75rem", fontWeight: 400 }}>{s.code}</span></td>
              <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink)" }}>{s.price.toLocaleString()}</td>
              <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "var(--mono)", color: priceColor(s.change_rate) }}>{pct(s.change_rate)}</td>
              <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "var(--mono)", color: priceColor(s.change), fontSize: "0.85rem" }}>{s.change >= 0 ? "+" : ""}{s.change.toLocaleString()}</td>
              <td style={{ padding: "10px 10px", textAlign: "right" }}>
                <button onClick={() => remove(s.code)} style={deleteBtn}>삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PortfolioSection() {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    apiPortfolio().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const remove = async (code: string) => {
    await apiRemovePortfolio(code);
    load();
  };

  if (loading) return <div style={{ color: "var(--ink-soft)", padding: "20px" }}>로딩 중...</div>;
  if (!data || data.items.length === 0) return <EmptyState label="포트폴리오가 비어 있습니다." />;

  return (
    <>
      {/* 요약 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px", marginBottom: "18px" }}>
        {[
          { label: "평가금액", value: `${(data.total_value / 1e4).toFixed(0)}만원` },
          { label: "투자원금", value: `${(data.total_cost / 1e4).toFixed(0)}만원` },
          { label: "손익", value: `${data.total_pnl >= 0 ? "+" : ""}${(data.total_pnl / 1e4).toFixed(0)}만원`, color: priceColor(data.total_pnl) },
          { label: "수익률", value: pct(data.total_pnl_pct), color: priceColor(data.total_pnl_pct) },
        ].map(m => (
          <div key={m.label} style={{
            ...cardStyle,
            padding: "14px 16px",
            boxShadow: "rgba(16,24,40,0.04) 0px 1px 4px",
          }}>
            <div style={{ fontSize: "0.7rem", color: "var(--ink-soft)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "6px" }}>{m.label}</div>
            <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: "1.05rem", color: m.color ?? "var(--ink)" }}>{m.value}</div>
          </div>
        ))}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
              {["종목", "보유주", "평균단가", "현재가", "평가손익", "수익률", ""].map(h => (
                <th key={h} style={{ padding: "10px 10px", textAlign: h === "종목" ? "left" : "right", fontSize: "0.72rem", fontWeight: 600, color: "var(--ink-muted)", letterSpacing: "0.03em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map(e => (
              <tr key={e.code} style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "10px 10px", fontWeight: 600, color: "var(--ink)" }}>{e.name}</td>
                <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "var(--mono)", color: "var(--ink)" }}>{e.shares.toLocaleString()}주</td>
                <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "var(--mono)", color: "var(--ink)" }}>{e.avg_price.toLocaleString()}</td>
                <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink)" }}>{e.current_price.toLocaleString()}</td>
                <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "var(--mono)", color: priceColor(e.pnl) }}>
                  {e.pnl >= 0 ? "+" : ""}{e.pnl.toLocaleString()}
                </td>
                <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "var(--mono)", color: priceColor(e.pnl_pct) }}>{pct(e.pnl_pct)}</td>
                <td style={{ padding: "10px 10px", textAlign: "right" }}>
                  <button onClick={() => remove(e.code)} style={deleteBtn}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function PortfolioPage({ favOnly = false }: { favOnly?: boolean }) {
  const { token } = useAuthStore();

  if (!token) return <LoginPrompt />;

  return (
    <div>
      <h1 style={{
        fontFamily: "var(--maru)", color: "var(--ink)",
        fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.5px",
        marginBottom: "20px",
      }}>
        {favOnly ? "관심종목" : "포트폴리오"}
      </h1>

      {favOnly ? (
        <div style={{ ...cardStyle, padding: "16px 16px 4px" }}>
          <SectionLabel>관심종목</SectionLabel>
          <FavoritesSection />
        </div>
      ) : (
        <>
          <div style={{ ...cardStyle, padding: "16px", marginBottom: "24px" }}>
            <SectionLabel>포트폴리오</SectionLabel>
            <PortfolioSection />
          </div>
          <div style={{ ...cardStyle, padding: "16px 16px 4px" }}>
            <SectionLabel>관심종목</SectionLabel>
            <FavoritesSection />
          </div>
        </>
      )}
    </div>
  );
}
