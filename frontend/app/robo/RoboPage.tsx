"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { apiRoboRecommend, apiRoboSurvey, BASE as API_BASE, type RoboResult, type RoboSurveyQuestion, type BacktestResult } from "@/lib/api";
import { useAuthStore, useUIStore } from "@/lib/store";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: "16px",
  boxShadow: "rgba(0,0,0,0.03) 0px 4px 24px",
};

function DataSourceBadge({ source, realtime }: { source: string; realtime: boolean }) {
  const isKIS = source === "KIS";
  const label = isKIS ? "KIS 실시간 시세" : "DEMO 모의 시세";
  const sub   = isKIS ? "한국투자증권 API" : "백테스트용 합성 데이터";
  return (
    <span title={sub} style={{
      display: "inline-flex", alignItems: "center", gap: "6px",
      background: isKIS ? "var(--purple)" : "rgba(104,107,130,0.18)",
      color: isKIS ? "#fff" : "var(--ink-muted)",
      fontFamily: "var(--mono)", fontSize: "0.7rem",
      fontWeight: 600, padding: "4px 10px", borderRadius: "8px",
      letterSpacing: "0.02em",
    }}>
      <span style={{
        width: "6px", height: "6px", borderRadius: "50%",
        background: realtime ? "#7CCB7A" : "var(--ink-soft)",
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
      <div style={{ fontFamily: "var(--maru)", fontSize: "0.78rem", fontWeight: 600, color: "var(--ink-muted)", marginBottom: "8px" }}>
        계산 조건 · 가정
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "8px 10px", color: "var(--ink-muted)", width: "38%", background: "var(--surface-2)", fontWeight: 500 }}>{k}</td>
              <td style={{ padding: "8px 10px", fontFamily: "var(--mono)", color: "var(--ink)" }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BacktestPanel({ backtest, color }: { backtest: BacktestResult; color: string }) {
  const pos = backtest.total_return >= 0;
  const retColor = pos ? "var(--red)" : "var(--blue)";
  const sign = pos ? "+" : "";
  const dates = backtest.series.map(p => p.date);
  const values = backtest.series.map(p => p.value);
  const uppers = backtest.series.map(p => p.upper ?? p.value);
  const lowers = backtest.series.map(p => p.lower ?? p.value);
  const drawdowns = backtest.series.map(p => p.drawdown ?? 0);
  const mdd = backtest.max_drawdown ?? 0;
  const source = backtest.data_source ?? "DEMO";
  const realtime = !!backtest.realtime;
  const plotBg = "#ffffff";
  const gridColor = "#eef0f4";

  return (
    <div style={{ ...cardStyle, padding: "20px", marginBottom: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
        <DataSourceBadge source={source} realtime={realtime} />
        <span style={{ fontSize: "0.72rem", color: "var(--ink-soft)" }}>
          기간: <b style={{ color: "var(--ink)" }}>{backtest.period_start}</b> ~ <b style={{ color: "var(--ink)" }}>{backtest.period_end}</b> · {backtest.days}영업일
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "14px", flexWrap: "wrap" }}>
        <div style={{ fontFamily: "var(--maru)", fontSize: "0.82rem", color: "var(--ink-muted)", fontWeight: 600 }}>
          만약 {backtest.days}영업일 전 이 포트폴리오에 투자했다면?
        </div>
        <div style={{
          background: retColor, color: "#fff",
          fontFamily: "var(--mono)", fontWeight: 700, fontSize: "1.6rem",
          padding: "4px 16px", borderRadius: "10px",
        }}>
          {sign}{backtest.total_return.toFixed(1)}%
        </div>
        <div style={{
          background: "var(--ink)", color: "#fff",
          fontFamily: "var(--mono)", fontSize: "0.78rem", fontWeight: 600,
          padding: "4px 10px", borderRadius: "8px",
        }}>
          MDD {mdd.toFixed(2)}%
        </div>
        <div style={{ fontSize: "0.72rem", color: "var(--ink-soft)" }}>
          ±1σ 밴드 · 수수료·세금 반영 · 투자 권유 아님
        </div>
      </div>

      <Plot
        data={[
          { x: dates, y: uppers, type: "scatter", mode: "lines",
            line: { color: "rgba(0,0,0,0)", width: 0 },
            hoverinfo: "skip", showlegend: false },
          { x: dates, y: lowers, type: "scatter", mode: "lines",
            line: { color: "rgba(0,0,0,0)", width: 0 },
            fill: "tonexty", fillcolor: `${color}22`,
            name: "±1σ 신뢰구간", hoverinfo: "skip" },
          { x: dates, y: values, type: "scatter", mode: "lines",
            line: { color, width: 2.2 },
            name: "포트폴리오 가치",
            hovertemplate: "<b>%{x}</b><br>가치: %{y:.2f}<extra></extra>" },
        ]}
        layout={{
          height: 220,
          margin: { l: 10, r: 56, t: 6, b: 28 },
          paper_bgcolor: plotBg,
          plot_bgcolor: plotBg,
          showlegend: false,
          xaxis: { type: "date", showgrid: false, tickfont: { size: 10 }, rangeslider: { visible: false } },
          yaxis: { side: "right", tickfont: { size: 10 }, gridcolor: gridColor, zeroline: false, title: { text: "가치 (시작=100)", font: { size: 9 } } },
          shapes: [{ type: "line", x0: dates[0], x1: dates[dates.length - 1], y0: 100, y1: 100,
            xref: "x", yref: "y", line: { color: "#7132f5", width: 1, dash: "dash" } }],
        }}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: "100%", height: "220px" }}
        useResizeHandler
      />

      <div style={{ marginTop: "8px", fontSize: "0.72rem", color: "var(--ink-muted)", fontFamily: "var(--maru)", fontWeight: 600 }}>
        Drawdown (고점 대비 낙폭 %)
      </div>
      <Plot
        data={[{
          x: dates, y: drawdowns, type: "bar",
          marker: { color: drawdowns.map(d => (d < -5 ? "#8B1A1A" : d < 0 ? "var(--red)" : "rgba(104,107,130,0.16)")) },
          hovertemplate: "<b>%{x}</b><br>낙폭: %{y:.2f}%<extra></extra>",
        }]}
        layout={{
          height: 90,
          margin: { l: 10, r: 56, t: 2, b: 22 },
          paper_bgcolor: plotBg,
          plot_bgcolor: plotBg,
          showlegend: false,
          xaxis: { type: "date", showgrid: false, tickfont: { size: 9 } },
          yaxis: { side: "right", tickfont: { size: 9 }, gridcolor: gridColor,
            zeroline: true, zerolinecolor: "#7132f5", rangemode: "tozero" },
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
      fontFamily: "var(--maru)", fontSize: "0.95rem", fontWeight: 700,
      letterSpacing: "-0.2px",
      borderLeft: "3px solid var(--purple)", padding: "2px 0 4px 12px",
      marginBottom: "14px", color: "var(--ink)",
    }}>
      {children}
    </div>
  );
}

function PrismBadge({ score }: { score: number }) {
  const bg   = score >= 70 ? "var(--purple-deep)" : score >= 50 ? "var(--purple)" : "var(--purple-subtle)";
  const fg   = score >= 50 ? "#fff" : "var(--purple)";
  return (
    <span style={{
      background: bg, color: fg, fontFamily: "var(--mono)", fontWeight: 600,
      fontSize: "0.74rem", padding: "3px 10px", borderRadius: "8px",
    }}>
      PRISM {score.toFixed(1)}
    </span>
  );
}

function WeightBar({ weight }: { weight: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{ flex: 1, height: "6px", background: "var(--purple-pale)", borderRadius: "3px" }}>
        <div style={{ width: `${weight}%`, height: "100%", background: "var(--purple)", borderRadius: "3px" }} />
      </div>
      <span style={{ fontFamily: "var(--mono)", fontSize: "0.78rem", fontWeight: 600, color: "var(--ink-muted)", width: "40px", textAlign: "right" }}>
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
        borderRadius: "16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "10px" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: "40px", height: "40px", borderRadius: "12px",
            background: result.color, color: "#fff",
            fontFamily: "var(--mono)", fontWeight: 700, fontSize: "1rem",
          }}>
            {result.profile_id}
          </span>
          <div>
            <div style={{ fontFamily: "var(--maru)", fontSize: "1.1rem", fontWeight: 700, color: result.fg, letterSpacing: "-0.3px" }}>
              {result.profile_name} <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>{result.profile_eng}</span>
            </div>
            <div style={{
              fontSize: "0.74rem", background: result.color, color: "#fff",
              display: "inline-block", padding: "2px 10px", marginTop: "4px",
              borderRadius: "8px",
            }}>
              {result.tag}
            </div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: "0.72rem", color: result.fg, opacity: 0.7 }}>PRISM 평균</div>
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
      <SectionLabel>PRISM 모멘텀 포트폴리오 ({result.items.length}종목)</SectionLabel>
      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
                {["종목", "업종", "PRISM 점수", "비중", "추천 근거"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: "0.72rem", fontWeight: 600, color: "var(--ink-muted)", letterSpacing: "0.03em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.items.map((item) => (
                <tr key={item.code} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td
                    style={{ padding: "12px", cursor: "pointer" }}
                    onClick={() => onSelectStock(item.code)}
                  >
                    <span style={{ fontWeight: 600, color: "var(--purple)" }}>{item.name}</span>
                    <span style={{ color: "var(--ink-soft)", fontSize: "0.75rem", marginLeft: "6px" }}>{item.code}</span>
                  </td>
                  <td style={{ padding: "12px", fontSize: "0.8rem", color: "var(--ink-muted)" }}>{item.sector}</td>
                  <td style={{ padding: "12px" }}><PrismBadge score={item.prism_score} /></td>
                  <td style={{ padding: "12px", minWidth: "140px" }}><WeightBar weight={item.weight} /></td>
                  <td style={{ padding: "12px", fontSize: "0.8rem", color: "var(--ink-muted)" }}>{item.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
      <div style={{ ...cardStyle, padding: "72px 24px", textAlign: "center", maxWidth: "500px", margin: "0 auto" }}>
        <div style={{ fontFamily: "var(--maru)", fontSize: "1.05rem", color: "var(--ink)", fontWeight: 600, marginBottom: "8px" }}>
          로그인이 필요합니다
        </div>
        <div style={{ fontSize: "0.86rem", color: "var(--ink-soft)" }}>
          로그인 후 PRISM 로보어드바이저를 이용할 수 있습니다.
        </div>
      </div>
    );
  }

  if (!isPremium()) {
    return (
      <div style={{ ...cardStyle, padding: "48px 24px", textAlign: "center", maxWidth: "500px", margin: "0 auto" }}>
        <div style={{
          display: "inline-block", background: "var(--purple)", color: "#fff",
          fontFamily: "var(--maru)", fontWeight: 700, fontSize: "0.7rem",
          padding: "4px 14px", letterSpacing: "0.12em", borderRadius: "9999px",
          marginBottom: "14px",
        }}>
          PREMIUM
        </div>
        <div style={{ fontFamily: "var(--maru)", fontSize: "1.3rem", fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.4px", marginBottom: "8px" }}>
          PRISM 로보어드바이저
        </div>
        <div style={{ color: "var(--ink-soft)", marginBottom: "22px", fontSize: "0.9rem" }}>
          프리미엄 구독자 전용 서비스입니다.
        </div>
        <div style={{
          display: "inline-block", background: "var(--purple)", color: "#fff",
          fontFamily: "var(--maru)", fontWeight: 600, padding: "12px 28px",
          cursor: "pointer", fontSize: "0.95rem", borderRadius: "12px",
        }}>
          PREMIUM 업그레이드
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
      <h1 style={{
        fontFamily: "var(--maru)", color: "var(--ink)",
        fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.5px",
        margin: "0 0 8px",
      }}>
        PRISM 로보어드바이저
      </h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem", marginBottom: "16px" }}>
        5가지 질문으로 투자 성향을 파악하고, 맞춤 포트폴리오를 추천합니다.
      </p>

      {/* 초보자용: PRISM이 뭐죠? 토글 */}
      <details style={{ marginBottom: "24px" }}>
        <summary style={{
          cursor: "pointer",
          fontSize: "0.78rem",
          color: "var(--ink-muted)",
          fontWeight: 600,
          letterSpacing: "0.02em",
          padding: "10px 14px",
          background: "var(--purple-pale)",
          border: "1px solid var(--line-soft)",
          borderRadius: "12px",
          userSelect: "none",
        }}>
          PRISM 모멘텀 스코어가 뭔가요? (펼쳐서 보기)
        </summary>
        <div style={{
          marginTop: "6px",
          padding: "16px 18px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "12px",
          fontSize: "0.84rem",
          lineHeight: 1.75,
          color: "var(--ink)",
        }}>
          <p style={{ marginTop: 0 }}>
            <b>PRISM(Predictive Resonance Index for Stock Momentum)</b>은 한 종목의 최근 60일 가격·거래량
            데이터를 5가지 기술적 지표로 점수화한 <b>0~100점 모멘텀 스코어</b>입니다.
          </p>
          <ul style={{ paddingLeft: "18px", margin: "8px 0" }}>
            <li><b>추세 (30%)</b> — 20일 평균 대비 현재가 위치</li>
            <li><b>모멘텀 (25%)</b> — 최근 5일 가격 변화율</li>
            <li><b>거래량 (20%)</b> — 5일 평균 vs 20일 평균 거래량 비율</li>
            <li><b>RSI (15%)</b> — 과매수/과매도 균형도</li>
            <li><b>안정성 (10%)</b> — 20일 변동성의 역</li>
          </ul>
          <p style={{ margin: "8px 0 0", color: "var(--ink-muted)", fontSize: "0.78rem" }}>
            <b>주의:</b> PRISM은 <b>AI나 머신러닝 모델이 아닌 규칙 기반 산식</b>입니다. 회사의 재무 건전성,
            업계 경쟁력, 뉴스 호재/악재 등은 반영되지 않습니다. 투자 판단의 보조 지표로만 활용하세요.
          </p>
        </div>
      </details>

      {!result ? (
        <div>
          {questions.map((q, qi) => (
            <div key={q.id} style={{ ...cardStyle, padding: "16px 18px", marginBottom: "14px" }}>
              <div style={{ fontWeight: 700, marginBottom: "12px", color: "var(--ink)", fontFamily: "var(--maru)", letterSpacing: "-0.2px" }}>
                <span style={{ color: "var(--purple)", marginRight: "8px" }}>Q{qi + 1}.</span>
                {q.q}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {q.opts.map((opt, i) => {
                  const sel = answers[q.id] === i;
                  return (
                    <label key={i} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name={q.id}
                        checked={sel}
                        onChange={() => setAnswers(prev => ({ ...prev, [q.id]: i }))}
                        style={{ accentColor: "var(--purple)" }}
                      />
                      <span style={{
                        fontSize: "0.88rem",
                        color: sel ? "var(--ink)" : "var(--ink-muted)",
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
              border: "1px solid var(--red)",
              background: "rgba(181,69,63,0.08)",
              color: "var(--red)",
              padding: "12px 16px",
              marginBottom: "16px",
              fontSize: "0.9rem",
              fontWeight: 500,
              lineHeight: 1.5,
              borderRadius: "12px",
            }}>
              <div style={{ fontFamily: "var(--maru)", fontWeight: 700, marginBottom: "4px" }}>분석 실패</div>
              <div style={{ fontSize: "0.82rem", wordBreak: "break-all" }}>{error}</div>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!allAnswered || loading}
            style={{
              padding: "12px 32px",
              background: allAnswered ? "var(--purple)" : "var(--surface-2)",
              color: allAnswered ? "#fff" : "var(--ink-soft)",
              border: "none", fontWeight: 600, fontSize: "1rem",
              cursor: allAnswered ? "pointer" : "not-allowed",
              fontFamily: "var(--maru)",
              borderRadius: "12px",
              transition: "background 160ms ease",
            }}
            onMouseEnter={e => { if (allAnswered && !loading) e.currentTarget.style.background = "var(--purple-deep)"; }}
            onMouseLeave={e => { if (allAnswered && !loading) e.currentTarget.style.background = "var(--purple)"; }}
          >
            {loading ? "분석 중..." : "PRISM 분석 시작"}
          </button>
        </div>
      ) : (
        <div>
          <ResultView result={result} onSelectStock={handleSelectStock} />
          <button
            onClick={() => { setResult(null); setAnswers({}); }}
            style={{
              marginTop: "20px", padding: "10px 24px",
              background: "var(--surface)", border: "1px solid var(--purple-dark)",
              color: "var(--purple-dark)", fontWeight: 600, cursor: "pointer", fontSize: "0.88rem",
              borderRadius: "12px",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--purple-pale)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--surface)")}
          >
            다시 설문하기
          </button>
        </div>
      )}
    </div>
  );
}
