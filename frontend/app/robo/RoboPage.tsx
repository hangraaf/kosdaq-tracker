"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { apiRoboRecommend, apiRoboSurvey, type RoboResult, type RoboSurveyQuestion, type BacktestResult } from "@/lib/api";
import { useAuthStore, useUIStore } from "@/lib/store";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

function BacktestPanel({ backtest, color }: { backtest: BacktestResult; color: string }) {
  const pos = backtest.total_return >= 0;
  const retColor = pos ? "#B5453F" : "#436B95";
  const sign = pos ? "+" : "";
  const dates = backtest.series.map(p => p.date);
  const values = backtest.series.map(p => p.value);

  return (
    <div style={{ border: "1px solid var(--border)", background: "var(--surf)", padding: "20px", marginBottom: "24px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "16px", marginBottom: "12px", flexWrap: "wrap" }}>
        <div style={{ fontFamily: "var(--maru)", fontSize: "0.82rem", color: "var(--muted)", fontWeight: 700 }}>
          만약 {backtest.days}영업일 전 이 포트폴리오에 투자했다면?
        </div>
        <div style={{ background: retColor, color: "#fff", fontFamily: "var(--mono)", fontWeight: 700, fontSize: "1.6rem", padding: "4px 16px" }}>
          {sign}{backtest.total_return.toFixed(1)}%
        </div>
        <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>모의 시뮬레이션 · 투자 참고용</div>
      </div>
      <Plot
        data={[{
          x: dates, y: values, type: "scatter", mode: "lines",
          line: { color, width: 2 },
          fill: "none",
          hovertemplate: "<b>%{x}</b><br>%{y:.2f}<extra></extra>",
        }]}
        layout={{
          height: 180,
          margin: { l: 10, r: 50, t: 4, b: 28 },
          paper_bgcolor: "rgba(253,250,244,1)",
          plot_bgcolor: "rgba(253,250,244,1)",
          showlegend: false,
          xaxis: { type: "date", showgrid: false, tickfont: { size: 10 }, rangeslider: { visible: false } },
          yaxis: { side: "right", tickfont: { size: 10 }, gridcolor: "#E8E1D0", zeroline: false },
          shapes: [{ type: "line", x0: dates[0], x1: dates[dates.length - 1], y0: 100, y1: 100,
            xref: "x", yref: "y", line: { color: "#B0883A", width: 1, dash: "dash" } }],
        }}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: "100%", height: "180px" }}
        useResizeHandler
      />
    </div>
  );
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

function PrismBadge({ score }: { score: number }) {
  const color = score >= 70 ? "#B5453F" : score >= 50 ? "#B0883A" : "#436B95";
  return (
    <span style={{
      background: color, color: "#fff", fontFamily: "var(--mono)", fontWeight: 700,
      fontSize: "0.75rem", padding: "2px 8px", borderRadius: "2px",
    }}>
      PRISM™ {score.toFixed(1)}
    </span>
  );
}

function WeightBar({ weight }: { weight: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{ flex: 1, height: "6px", background: "var(--surf2)", borderRadius: "3px" }}>
        <div style={{ width: `${weight}%`, height: "100%", background: "var(--blue)", borderRadius: "3px" }} />
      </div>
      <span style={{ fontFamily: "var(--mono)", fontSize: "0.78rem", fontWeight: 700, color: "var(--muted)", width: "40px", textAlign: "right" }}>
        {weight.toFixed(1)}%
      </span>
    </div>
  );
}

function ResultView({ result, onSelectStock }: { result: RoboResult; onSelectStock: (code: string) => void }) {
  return (
    <div>
      {/* 성향 카드 */}
      <div style={{
        background: result.bg, border: `2px solid ${result.color}`,
        padding: "20px", marginBottom: "24px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <span style={{ fontSize: "2rem" }}>{["🛡","⚓","⚖","🚀","⚡"][result.profile_id - 1]}</span>
          <div>
            <div style={{ fontFamily: "var(--maru)", fontSize: "1.1rem", fontWeight: 700, color: result.fg }}>
              {result.profile_name} <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>{result.profile_eng}</span>
            </div>
            <div style={{ fontSize: "0.78rem", background: result.color, color: "#fff", display: "inline-block", padding: "1px 8px", marginTop: "2px" }}>
              {result.tag}
            </div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: "0.72rem", color: result.fg, opacity: 0.7 }}>PRISM™ 평균</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: "1.4rem", fontWeight: 700, color: result.color }}>{result.score_total}</div>
          </div>
        </div>
        <div style={{ fontSize: "0.88rem", color: result.fg, lineHeight: 1.6 }}>{result.profile_desc}</div>
      </div>

      {/* 백테스팅 시뮬레이션 */}
      {result.backtest && result.backtest.ok && result.backtest.series.length > 0 && (
        <BacktestPanel backtest={result.backtest} color={result.color} />
      )}

      {/* 추천 종목 */}
      <SectionLabel>PRISM™ 추천 포트폴리오 ({result.items.length}종목)</SectionLabel>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ background: "var(--surf2)", borderBottom: "2px solid var(--border)" }}>
              {["종목", "업종", "PRISM™ 점수", "비중", "추천 근거"].map(h => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.items.map((item) => (
              <tr key={item.code} style={{ borderBottom: "1px solid var(--border)" }}>
                <td
                  style={{ padding: "10px 10px", cursor: "pointer" }}
                  onClick={() => onSelectStock(item.code)}
                >
                  <span style={{ fontWeight: 600, color: "var(--blue)", textDecoration: "underline" }}>{item.name}</span>
                  <span style={{ color: "var(--muted)", fontSize: "0.75rem", marginLeft: "6px" }}>{item.code}</span>
                </td>
                <td style={{ padding: "10px 10px", fontSize: "0.8rem", color: "var(--muted)" }}>{item.sector}</td>
                <td style={{ padding: "10px 10px" }}><PrismBadge score={item.prism_score} /></td>
                <td style={{ padding: "10px 10px", minWidth: "140px" }}><WeightBar weight={item.weight} /></td>
                <td style={{ padding: "10px 10px", fontSize: "0.8rem", color: "var(--muted)" }}>{item.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: "16px", padding: "12px", background: "var(--surf2)", fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.7 }}>
        ※ PRISM™(Predictive Resonance Index for Stock Momentum)은 기술적 분석 기반의 자체 스코어링 시스템입니다.
        본 추천은 투자 참고용이며 실제 투자 결과를 보장하지 않습니다.
        모든 투자 결정과 책임은 투자자 본인에게 있습니다.
      </div>
    </div>
  );
}

export default function RoboPage() {
  const { token, isPremium } = useAuthStore();
  const { setChart } = useUIStore();

  const handleSelectStock = (code: string) => {
    setChart(code);
  };
  const [questions, setQuestions] = useState<RoboSurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<RoboResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRoboSurvey().then(setQuestions);
  }, []);

  if (!token) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center", color: "var(--muted)" }}>
        <div style={{ fontSize: "2rem", marginBottom: "12px" }}>🔐</div>
        <div style={{ fontFamily: "var(--maru)", fontSize: "1rem" }}>로그인 후 이용 가능한 서비스입니다.</div>
      </div>
    );
  }

  if (!isPremium()) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🤖</div>
        <div style={{ fontFamily: "var(--maru)", fontSize: "1.2rem", color: "var(--blue-deep)", marginBottom: "8px" }}>
          PRISM™ 로보어드바이저
        </div>
        <div style={{ color: "var(--muted)", marginBottom: "20px" }}>프리미엄 구독자 전용 서비스입니다.</div>
        <div style={{
          display: "inline-block", background: "#D4A030", color: "#3A1208",
          fontFamily: "var(--maru)", fontWeight: 700, padding: "12px 28px",
          cursor: "pointer", fontSize: "1rem",
        }}>
          ★ PREMIUM 업그레이드
        </div>
      </div>
    );
  }

  const allAnswered = questions.length > 0 && questions.every(q => answers[q.id] !== undefined);

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiRoboRecommend({
        q_goal:    answers["q_goal"]    ?? 2,
        q_horizon: answers["q_horizon"] ?? 2,
        q_loss:    answers["q_loss"]    ?? 2,
        q_exp:     answers["q_exp"]     ?? 2,
        q_panic:   answers["q_panic"]   ?? 2,
      });
      setResult(res);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontFamily: "var(--maru)", color: "var(--blue-deep)", marginBottom: "8px" }}>
        🤖 PRISM™ 로보어드바이저
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "0.88rem", marginBottom: "24px" }}>
        Predictive Resonance Index for Stock Momentum — 5가지 질문으로 맞춤 포트폴리오를 추천합니다.
      </p>

      {!result ? (
        <div>
          {questions.map((q, qi) => (
            <div key={q.id} className="bh-card" style={{ marginBottom: "16px" }}>
              <div style={{ fontWeight: 700, marginBottom: "12px", color: "var(--fg)" }}>
                <span style={{ color: "var(--blue)", marginRight: "8px" }}>Q{qi + 1}.</span>
                {q.q}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {q.opts.map((opt, i) => {
                  const sel = answers[q.id] === i;
                  return (
                    <label key={i} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name={q.id}
                        checked={sel}
                        onChange={() => setAnswers(prev => ({ ...prev, [q.id]: i }))}
                        style={{ accentColor: "var(--blue)" }}
                      />
                      <span style={{
                        fontSize: "0.88rem",
                        color: sel ? "var(--fg)" : "var(--muted)",
                        fontWeight: sel ? 600 : 400,
                      }}>
                        {opt}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          {error && <div style={{ color: "var(--red)", marginBottom: "12px", fontSize: "0.88rem" }}>{error}</div>}

          <button
            onClick={handleSubmit}
            disabled={!allAnswered || loading}
            style={{
              padding: "12px 32px",
              background: allAnswered ? "var(--blue)" : "var(--surf2)",
              color: allAnswered ? "#fff" : "var(--muted)",
              border: "none", fontWeight: 700, fontSize: "1rem",
              cursor: allAnswered ? "pointer" : "not-allowed",
              fontFamily: "var(--maru)",
              transition: "all 0.2s",
            }}
          >
            {loading ? "분석 중..." : "PRISM™ 분석 시작"}
          </button>
        </div>
      ) : (
        <div>
          <ResultView result={result} onSelectStock={handleSelectStock} />
          <button
            onClick={() => { setResult(null); setAnswers({}); }}
            style={{
              marginTop: "20px", padding: "10px 24px",
              background: "var(--surf)", border: "1px solid var(--border)",
              color: "var(--muted)", fontWeight: 600, cursor: "pointer", fontSize: "0.88rem",
            }}
          >
            다시 설문하기
          </button>
        </div>
      )}
    </div>
  );
}
