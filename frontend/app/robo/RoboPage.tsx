"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { apiRoboRecommend, apiRoboSurvey, BASE as API_BASE, type RoboResult, type RoboSurveyQuestion, type BacktestResult } from "@/lib/api";
import { useAuthStore, useUIStore } from "@/lib/store";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

function DataSourceBadge({ source, realtime }: { source: string; realtime: boolean }) {
  const isKIS = source === "KIS";
  const bg = isKIS ? "#0D2A4A" : "#7A6A4A";
  const label = isKIS ? "KIS 실시간 시세" : "DEMO 모의 시세";
  const sub = isKIS ? "한국투자증권 API" : "백테스트용 합성 데이터";
  return (
    <span title={sub} style={{
      display: "inline-flex", alignItems: "center", gap: "6px",
      background: bg, color: "#fff", fontFamily: "var(--mono)", fontSize: "0.7rem",
      fontWeight: 700, padding: "3px 10px", borderRadius: "2px", letterSpacing: "0.02em",
    }}>
      <span style={{
        width: "6px", height: "6px", borderRadius: "50%",
        background: realtime ? "#7CCB7A" : "#E8C46A",
        boxShadow: realtime ? "0 0 6px #7CCB7A" : "none",
      }} />
      {label}
    </span>
  );
}

function ConditionsTable({ backtest }: { backtest: BacktestResult }) {
  const rows: Array<[string, string]> = [
    ["데이터 출처", backtest.data_source === "KIS" ? "한국투자증권(KIS) Open API" : "DEMO 합성 시세 (백테스트 검증용)"],
    ["시세 모드", backtest.realtime ? "실시간 (장중 KIS 시세)" : "지연/모의 (실제 거래 데이터 아님)"],
    ["분석 기간", `${backtest.period_start ?? "-"} ~ ${backtest.period_end ?? "-"} (${backtest.days}영업일)`],
    ["매매 수수료", `${((backtest.fee_rate ?? 0) * 100).toFixed(2)}% (매수+매도 합산 가정)`],
    ["거래세", `${((backtest.tax_rate ?? 0) * 100).toFixed(2)}% (매도 시)`],
    ["리밸런싱", backtest.rebalance ?? "기간 내 보유"],
    ["연환산 변동성(σ)", `${(backtest.annualized_volatility ?? 0).toFixed(2)}%`],
    ["샤프 비율", backtest.sharpe == null ? "—" : backtest.sharpe.toFixed(2)],
    ["최대 낙폭(MDD)", `${(backtest.max_drawdown ?? 0).toFixed(2)}%`],
  ];
  return (
    <div style={{ marginTop: "16px" }}>
      <div style={{ fontFamily: "var(--maru)", fontSize: "0.78rem", fontWeight: 700, color: "var(--muted)", marginBottom: "6px" }}>
        ▣ 계산 조건 · 가정
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "6px 10px", color: "var(--muted)", width: "38%", background: "var(--surf2)", fontWeight: 600 }}>{k}</td>
              <td style={{ padding: "6px 10px", fontFamily: "var(--mono)", color: "var(--fg)" }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BacktestPanel({ backtest, color }: { backtest: BacktestResult; color: string }) {
  const pos = backtest.total_return >= 0;
  const retColor = pos ? "#B5453F" : "#436B95";
  const sign = pos ? "+" : "";
  const dates = backtest.series.map(p => p.date);
  const values = backtest.series.map(p => p.value);
  const uppers = backtest.series.map(p => p.upper ?? p.value);
  const lowers = backtest.series.map(p => p.lower ?? p.value);
  const drawdowns = backtest.series.map(p => p.drawdown ?? 0);
  const mdd = backtest.max_drawdown ?? 0;
  const source = backtest.data_source ?? "DEMO";
  const realtime = !!backtest.realtime;

  return (
    <div style={{ border: "1px solid var(--border)", background: "var(--surf)", padding: "20px", marginBottom: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
        <DataSourceBadge source={source} realtime={realtime} />
        <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
          기간: <b style={{ color: "var(--fg)" }}>{backtest.period_start}</b> ~ <b style={{ color: "var(--fg)" }}>{backtest.period_end}</b> · {backtest.days}영업일
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: "16px", marginBottom: "12px", flexWrap: "wrap" }}>
        <div style={{ fontFamily: "var(--maru)", fontSize: "0.82rem", color: "var(--muted)", fontWeight: 700 }}>
          만약 {backtest.days}영업일 전 이 포트폴리오에 투자했다면?
        </div>
        <div style={{ background: retColor, color: "#fff", fontFamily: "var(--mono)", fontWeight: 700, fontSize: "1.6rem", padding: "4px 16px" }}>
          {sign}{backtest.total_return.toFixed(1)}%
        </div>
        <div style={{
          background: "#3A1208", color: "#F0C8B0",
          fontFamily: "var(--mono)", fontSize: "0.78rem", fontWeight: 700,
          padding: "4px 10px",
        }}>
          MDD {mdd.toFixed(2)}%
        </div>
        <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
          ±1σ 밴드 · 수수료·세금 반영 · 투자 권유 아님
        </div>
      </div>

      {/* 누적 수익률 + 신뢰구간 밴드 */}
      <Plot
        data={[
          // upper (invisible upper bound)
          {
            x: dates, y: uppers, type: "scatter", mode: "lines",
            line: { color: "rgba(0,0,0,0)", width: 0 },
            hoverinfo: "skip", showlegend: false,
          },
          // lower with fill to upper → band
          {
            x: dates, y: lowers, type: "scatter", mode: "lines",
            line: { color: "rgba(0,0,0,0)", width: 0 },
            fill: "tonexty", fillcolor: `${color}22`,
            name: "±1σ 신뢰구간", hoverinfo: "skip",
          },
          // mid path
          {
            x: dates, y: values, type: "scatter", mode: "lines",
            line: { color, width: 2.2 },
            name: "포트폴리오 가치",
            hovertemplate: "<b>%{x}</b><br>가치: %{y:.2f}<extra></extra>",
          },
        ]}
        layout={{
          height: 220,
          margin: { l: 10, r: 56, t: 6, b: 28 },
          paper_bgcolor: "rgba(253,250,244,1)",
          plot_bgcolor: "rgba(253,250,244,1)",
          showlegend: false,
          xaxis: { type: "date", showgrid: false, tickfont: { size: 10 }, rangeslider: { visible: false } },
          yaxis: { side: "right", tickfont: { size: 10 }, gridcolor: "#E8E1D0", zeroline: false, title: { text: "가치 (시작=100)", font: { size: 9 } } },
          shapes: [{ type: "line", x0: dates[0], x1: dates[dates.length - 1], y0: 100, y1: 100,
            xref: "x", yref: "y", line: { color: "#B0883A", width: 1, dash: "dash" } }],
        }}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: "100%", height: "220px" }}
        useResizeHandler
      />

      {/* Drawdown bar — 손실 구간 시각화 */}
      <div style={{ marginTop: "6px", fontSize: "0.7rem", color: "var(--muted)", fontFamily: "var(--maru)", fontWeight: 700 }}>
        ▼ Drawdown (고점 대비 낙폭 %)
      </div>
      <Plot
        data={[{
          x: dates, y: drawdowns, type: "bar",
          marker: { color: drawdowns.map(d => (d < -5 ? "#8B1A1A" : d < 0 ? "#B5453F" : "#7CCB7A")) },
          hovertemplate: "<b>%{x}</b><br>낙폭: %{y:.2f}%<extra></extra>",
        }]}
        layout={{
          height: 90,
          margin: { l: 10, r: 56, t: 2, b: 22 },
          paper_bgcolor: "rgba(253,250,244,1)",
          plot_bgcolor: "rgba(253,250,244,1)",
          showlegend: false,
          xaxis: { type: "date", showgrid: false, tickfont: { size: 9 } },
          yaxis: { side: "right", tickfont: { size: 9 }, gridcolor: "#E8E1D0",
            zeroline: true, zerolinecolor: "#B0883A", rangemode: "tozero" },
        }}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: "100%", height: "90px" }}
        useResizeHandler
      />

      <ConditionsTable backtest={backtest} />
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

      <ComplianceFooter />
    </div>
  );
}

function ComplianceFooter() {
  return (
    <div style={{
      marginTop: "20px",
      border: "1px solid #B0883A",
      background: "#FBF6E8",
      padding: "14px 16px",
      fontSize: "0.74rem",
      color: "#4A2E00",
      lineHeight: 1.75,
    }}>
      <div style={{ fontFamily: "var(--maru)", fontWeight: 800, fontSize: "0.82rem", marginBottom: "6px", color: "#3A1208" }}>
        ⚠ 투자 위험 고지 · 법적 면책 (필독)
      </div>
      <ol style={{ paddingLeft: "18px", margin: 0 }}>
        <li>
          본 콘텐츠는 <b>KOSDAQ Tracker</b>가 제공하는 자체 기술적 분석(PRISM™) 기반의
          <b> 정보 제공 서비스</b>로, 「자본시장과 금융투자업에 관한 법률」상 투자자문업·투자일임업에
          해당하지 않으며 <b>투자 권유를 목적으로 하지 않습니다</b>.
        </li>
        <li>
          PRISM™ 점수, 추천 종목, 백테스트 수익률은 모두 <b>과거 데이터에 기반한 모의 결과</b>이며,
          <b> 과거의 수익률은 미래의 수익을 보장하지 않습니다</b>.
        </li>
        <li>
          백테스트는 실제 매매가 아닌 <b>시뮬레이션</b>입니다. 매매 수수료·세금·슬리피지·유동성 제약을
          단순화한 가정이며, <b>실제 투자 결과와 일치하지 않을 수 있습니다</b>.
        </li>
        <li>
          KIS 모드는 한국투자증권 Open API의 실시간 시세를, DEMO 모드는 검증용 합성 시세를 사용합니다.
          DEMO 결과는 <b>실제 종목의 손익과 무관</b>합니다.
        </li>
        <li>
          모든 투자 판단과 그에 따른 <b>이익·손실의 책임은 전적으로 투자자 본인</b>에게 있으며,
          KOSDAQ Tracker는 본 서비스 이용으로 발생한 손실에 대해 책임지지 않습니다.
        </li>
      </ol>
      <div style={{ marginTop: "8px", fontSize: "0.7rem", color: "#7A4E1A", borderTop: "1px dashed #B0883A", paddingTop: "6px" }}>
        © KOSDAQ Tracker · PRISM™은 자체 기술적 스코어링 지표입니다. 문의: hangraaf@gmail.com
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
      console.log("[backtest]", res.backtest);
      setResult(res);
    } catch (e: unknown) {
      console.error("[robo] recommend failed", e, "API_BASE=", API_BASE);
      setError(`${(e as Error).message} (API: ${API_BASE})`);
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

          {error && (
            <div style={{
              border: "2px solid #B82828",
              background: "#FFF0F0",
              color: "#8B1A1A",
              padding: "12px 16px",
              marginBottom: "16px",
              fontSize: "0.9rem",
              fontWeight: 600,
              lineHeight: 1.5,
            }}>
              <div style={{ fontFamily: "var(--maru)", marginBottom: "4px" }}>⚠ 분석 실패</div>
              <div style={{ fontWeight: 400, fontSize: "0.82rem", wordBreak: "break-all" }}>{error}</div>
            </div>
          )}

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
