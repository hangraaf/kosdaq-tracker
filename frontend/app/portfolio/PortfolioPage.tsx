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

function LoginPrompt() {
  return (
    <div style={{ padding: "60px 0", textAlign: "center", color: "var(--muted)" }}>
      <div style={{ fontSize: "2rem", marginBottom: "12px" }}>🔐</div>
      <div style={{ fontFamily: "var(--maru)", fontSize: "1rem" }}>
        로그인하면 관심종목과 포트폴리오를 저장할 수 있습니다.
      </div>
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

  if (loading) return <div style={{ color: "var(--muted)", padding: "20px" }}>로딩 중...</div>;
  if (items.length === 0) return (
    <div style={{ padding: "40px 0", textAlign: "center", color: "var(--muted)" }}>
      <div style={{ fontSize: "1.5rem" }}>★</div>
      <div style={{ marginTop: "8px", fontFamily: "var(--maru)" }}>관심종목이 없습니다.</div>
    </div>
  );

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
        <thead>
          <tr style={{ background: "var(--surf2)", borderBottom: "2px solid var(--border)" }}>
            {["종목명", "현재가", "등락률", "전일대비", ""].map(h => (
              <th key={h} style={{ padding: "8px 10px", textAlign: h === "종목명" ? "left" : "right", fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(s => (
            <tr key={s.code} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "8px 10px", fontWeight: 600 }}>{s.name} <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{s.code}</span></td>
              <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--mono)", fontWeight: 700 }}>{s.price.toLocaleString()}</td>
              <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--mono)", color: priceColor(s.change_rate) }}>{pct(s.change_rate)}</td>
              <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--mono)", color: priceColor(s.change), fontSize: "0.85rem" }}>{s.change >= 0 ? "+" : ""}{s.change.toLocaleString()}</td>
              <td style={{ padding: "8px 10px", textAlign: "right" }}>
                <button onClick={() => remove(s.code)} style={{ background: "none", border: "1px solid var(--border)", color: "var(--muted)", padding: "3px 8px", cursor: "pointer", fontSize: "0.75rem" }}>삭제</button>
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

  if (loading) return <div style={{ color: "var(--muted)", padding: "20px" }}>로딩 중...</div>;
  if (!data || data.items.length === 0) return (
    <div style={{ padding: "40px 0", textAlign: "center", color: "var(--muted)" }}>
      <div style={{ fontSize: "1.5rem" }}>◈</div>
      <div style={{ marginTop: "8px", fontFamily: "var(--maru)" }}>포트폴리오가 비어 있습니다.</div>
    </div>
  );

  return (
    <>
      {/* 요약 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px", marginBottom: "16px" }}>
        {[
          { label: "평가금액", value: `${(data.total_value / 1e4).toFixed(0)}만원` },
          { label: "투자원금", value: `${(data.total_cost / 1e4).toFixed(0)}만원` },
          { label: "손익", value: `${data.total_pnl >= 0 ? "+" : ""}${(data.total_pnl / 1e4).toFixed(0)}만원`, color: priceColor(data.total_pnl) },
          { label: "수익률", value: pct(data.total_pnl_pct), color: priceColor(data.total_pnl_pct) },
        ].map(m => (
          <div key={m.label} className="bh-card" style={{ padding: "12px" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "4px" }}>{m.label}</div>
            <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: "1rem", color: m.color ?? "var(--fg)" }}>{m.value}</div>
          </div>
        ))}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ background: "var(--surf2)", borderBottom: "2px solid var(--border)" }}>
              {["종목", "보유주", "평균단가", "현재가", "평가손익", "수익률", ""].map(h => (
                <th key={h} style={{ padding: "8px 10px", textAlign: h === "종목" ? "left" : "right", fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map(e => (
              <tr key={e.code} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "8px 10px", fontWeight: 600 }}>{e.name}</td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--mono)" }}>{e.shares.toLocaleString()}주</td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--mono)" }}>{e.avg_price.toLocaleString()}</td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--mono)", fontWeight: 700 }}>{e.current_price.toLocaleString()}</td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--mono)", color: priceColor(e.pnl) }}>
                  {e.pnl >= 0 ? "+" : ""}{e.pnl.toLocaleString()}
                </td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--mono)", color: priceColor(e.pnl_pct) }}>{pct(e.pnl_pct)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>
                  <button onClick={() => remove(e.code)} style={{ background: "none", border: "1px solid var(--border)", color: "var(--muted)", padding: "3px 8px", cursor: "pointer", fontSize: "0.75rem" }}>삭제</button>
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
      <h1 style={{ fontFamily: "var(--maru)", color: "var(--blue-deep)", marginBottom: "20px" }}>
        {favOnly ? "관심종목" : "포트폴리오"}
      </h1>

      {favOnly ? (
        <div className="bh-card" style={{ padding: "0 0 12px" }}>
          <div style={{ padding: "16px 16px 0" }}><SectionLabel>★ 관심종목</SectionLabel></div>
          <FavoritesSection />
        </div>
      ) : (
        <>
          <div className="bh-card" style={{ padding: "16px", marginBottom: "24px" }}>
            <SectionLabel>◈ 포트폴리오</SectionLabel>
            <PortfolioSection />
          </div>
          <div className="bh-card" style={{ padding: "0 0 12px" }}>
            <div style={{ padding: "16px 16px 0" }}><SectionLabel>★ 관심종목</SectionLabel></div>
            <FavoritesSection />
          </div>
        </>
      )}
    </div>
  );
}
