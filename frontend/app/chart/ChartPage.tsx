"use client";

import { useEffect, useState } from "react";
import {
  apiChart, apiSnapshot,
  type OHLCVRow, type StockSnapshot,
} from "@/lib/api";
import LiveBadge from "@/components/LiveBadge";
import TradingChart from "@/components/Chart/TradingChart";
import { useUIStore } from "@/lib/store";

const PERIODS = ["5일", "2주", "1개월", "3개월", "6개월", "1년", "2년"];

function pct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function computeMA(closes: number[], n: number) {
  return closes.map((_, i) =>
    i < n - 1 ? null : closes.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n
  );
}

function rsiCalc(closes: number[], n = 14): (number | null)[] {
  const out: (number | null)[] = Array(n).fill(null);
  for (let i = n; i < closes.length; i++) {
    let gain = 0, loss = 0;
    for (let j = i - n + 1; j <= i; j++) {
      const d = closes[j] - closes[j - 1];
      if (d >= 0) gain += d; else loss -= d;
    }
    out.push(loss === 0 ? 100 : 100 - 100 / (1 + gain / loss));
  }
  return out;
}

function emaCalc(arr: number[], n: number): number[] {
  const k = 2 / (n + 1);
  return arr.reduce<number[]>((acc, v, i) => {
    acc.push(i === 0 ? v : v * k + acc[i - 1] * (1 - k));
    return acc;
  }, []);
}

function macdCalc(closes: number[]) {
  const fast = emaCalc(closes, 12), slow = emaCalc(closes, 26);
  const line  = fast.map((v, i) => v - slow[i]);
  const sig   = emaCalc(line, 9);
  const hist  = line.map((v, i) => v - sig[i]);
  return { hist };
}

// ── 신호 요약 계산 ──────────────────────────────────────────────────────
function buildSignals(ohlcv: OHLCVRow[]) {
  const closes = ohlcv.map(d => d.close);
  const ma5  = computeMA(closes, 5);
  const ma20 = computeMA(closes, 20);
  const ma60 = computeMA(closes, 60);
  const last = closes[closes.length - 1] ?? 0;
  const lm5  = ma5[ma5.length - 1];
  const lm20 = ma20[ma20.length - 1];
  const lm60 = ma60[ma60.length - 1];

  // MA 배열 상태
  let maTrend = "혼조", maTrendColor = "var(--muted)";
  if (lm5 && lm20 && lm60) {
    if (last > lm5 && lm5 > lm20 && lm20 > lm60) {
      maTrend = "정배열 (상승)"; maTrendColor = "#B5453F";
    } else if (last < lm5 && lm5 < lm20 && lm20 < lm60) {
      maTrend = "역배열 (하락)"; maTrendColor = "#436B95";
    }
  }

  // 골든/데드크로스 최근 감지
  let crossSignal = "없음", crossColor = "var(--muted)";
  let crossDesc = "MA5와 MA20이 교차하지 않았습니다.";
  for (let i = ohlcv.length - 1; i >= Math.max(0, ohlcv.length - 30); i--) {
    const p5 = ma5[i - 1], p20 = ma20[i - 1], c5 = ma5[i], c20 = ma20[i];
    if (p5 === null || p20 === null || c5 === null || c20 === null) continue;
    if (p5 < p20 && c5 >= c20) {
      crossSignal = "골든크로스 ▲"; crossColor = "#B0883A";
      crossDesc = "MA5가 MA20 위로 돌파 — 단기 상승 전환 신호입니다.";
      break;
    }
    if (p5 > p20 && c5 <= c20) {
      crossSignal = "데드크로스 ▼"; crossColor = "#436B95";
      crossDesc = "MA5가 MA20 아래로 돌파 — 단기 하락 전환 신호입니다.";
      break;
    }
  }

  // RSI (직접 계산)
  const rsiArr = rsiCalc(closes);
  const lastRsi = rsiArr[rsiArr.length - 1];
  let rsiStatus = "-", rsiColor = "var(--muted)", rsiDesc = "";
  if (lastRsi !== null) {
    if (lastRsi >= 70) {
      rsiStatus = `${lastRsi.toFixed(0)} 과매수 주의`; rsiColor = "#B5453F";
      rsiDesc = "RSI 70 이상 — 단기 고점 가능성, 신중하게 접근하세요.";
    } else if (lastRsi <= 30) {
      rsiStatus = `${lastRsi.toFixed(0)} 과매도 반등 기대`; rsiColor = "#436B95";
      rsiDesc = "RSI 30 이하 — 과도 하락, 반등을 기대해볼 수 있습니다.";
    } else {
      rsiStatus = `${lastRsi.toFixed(0)} 중립`; rsiColor = "var(--fg)";
      rsiDesc = "RSI 30~70 중립 구간입니다.";
    }
  }

  // MACD (직접 계산)
  const { hist } = macdCalc(closes);
  const lastHist = hist[hist.length - 1] ?? null;
  const prevHist = hist[hist.length - 2] ?? null;
  let macdStatus = "-", macdColor = "var(--muted)", macdDesc = "";
  if (lastHist !== null) {
    const growing = prevHist !== null && lastHist > prevHist;
    if (lastHist > 0) {
      macdStatus = growing ? "▲ 상승세 강화" : "▲ 매수세 우세"; macdColor = "#B5453F";
      macdDesc = "MACD 막대가 0선 위 — 매수세 우세 상태입니다.";
    } else {
      macdStatus = growing ? "▼ 하락세 약화" : "▼ 매도세 우세"; macdColor = "#436B95";
      macdDesc = "MACD 막대가 0선 아래 — 매도세 우세 상태입니다.";
    }
  }

  return { maTrend, maTrendColor, crossSignal, crossColor, crossDesc, rsiStatus, rsiColor, rsiDesc, macdStatus, macdColor, macdDesc };
}

// ── 신호 카드 ─────────────────────────────────────────────────────────
interface SigCardProps {
  title: string;
  value: string;
  valueColor: string;
  desc: string;
  badge?: string;
}
function SigCard({ title, value, valueColor, desc, badge }: SigCardProps) {
  return (
    <div style={{
      flex: "1 1 180px",
      padding: "10px 14px",
      background: "#F3EEE3",
      border: "1px solid var(--border)",
      borderTop: `3px solid ${valueColor}`,
    }}>
      <div style={{ fontSize: "0.62rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 700, marginBottom: "5px" }}>
        {title} {badge && <span style={{ background: "var(--blue-pale)", color: "var(--blue-deep)", padding: "1px 5px", fontSize: "0.58rem", fontWeight: 800, marginLeft: "4px" }}>{badge}</span>}
      </div>
      <div style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: "0.92rem", color: valueColor, marginBottom: "5px" }}>
        {value}
      </div>
      <div style={{ fontSize: "0.7rem", color: "var(--muted)", lineHeight: 1.5 }}>
        {desc}
      </div>
    </div>
  );
}

export default function ChartPage() {
  const { selectedCode, period, setPeriod } = useUIStore();
  const [snap, setSnap]       = useState<StockSnapshot | null>(null);
  const [ohlcv, setOhlcv]     = useState<OHLCVRow[]>([]);
  const [ohlcv3m, setOhlcv3m] = useState<OHLCVRow[]>([]);
  const [isLive, setIsLive]   = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedCode) return;
    setLoading(true);
    Promise.all([
      apiSnapshot(selectedCode),
      apiChart(selectedCode, period),
      apiChart(selectedCode, "3개월"),
    ]).then(([s, c, c3m]) => {
      setSnap(s);
      setOhlcv(c.items);
      setIsLive(c.live);
      setOhlcv3m(c3m.items);
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

  // 3개월 고/저 계산
  const h3m = ohlcv3m.length ? Math.max(...ohlcv3m.map(d => d.high)) : 0;
  const l3m = ohlcv3m.length ? Math.min(...ohlcv3m.map(d => d.low))  : 0;
  const curPrice = snap?.price ?? 0;
  const pctH3m = curPrice > 0 && h3m > 0 ? ((h3m / curPrice) - 1) * 100 : 0;
  const pctL3m = curPrice > 0 && l3m > 0 ? ((l3m / curPrice) - 1) * 100 : 0;
  const hl3mRange = h3m > l3m ? ((curPrice - l3m) / (h3m - l3m) * 100) : 50;
  const hl3mWidth = `${Math.min(100, Math.max(0, hl3mRange)).toFixed(1)}%`;

  const signals = ohlcv.length > 0 ? buildSignals(ohlcv) : null;

  return (
    <div>
      {/* ── 헤더 ─────────────────────────────────────── */}
      {snap && (
        <div style={{ marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
            <h1 style={{ fontFamily: "var(--maru)", color: "var(--blue-deep)", margin: 0 }}>
              {snap.name}
            </h1>
            <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{snap.code} · {snap.market}</span>
            <LiveBadge live={isLive} />
          </div>

          {/* 현재가 + 등락 */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: "14px", marginTop: "6px", flexWrap: "wrap" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: "1.8rem", fontWeight: 800, color: "var(--fg)" }}>
              {snap.price.toLocaleString()}원
            </div>
            <div style={{
              fontFamily: "var(--mono)", fontSize: "1.1rem", fontWeight: 700,
              color: snap.change_rate >= 0 ? "var(--red)" : "var(--blue)",
              paddingBottom: "3px",
            }}>
              {pct(snap.change_rate)} ({snap.change >= 0 ? "+" : ""}{snap.change.toLocaleString()})
            </div>
          </div>

          {/* 지표 카드 4개 */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: "6px",
            marginTop: "10px",
          }}>
            {[
              { label: "거래량",   value: snap.volume.toLocaleString() },
              { label: "시가총액", value: snap.market_cap >= 1e12 ? `${(snap.market_cap / 1e12).toFixed(1)}조` : `${(snap.market_cap / 1e8).toFixed(0)}억` },
              { label: "업종",     value: snap.sector },
              { label: "시장",     value: snap.market },
            ].map(m => (
              <div key={m.label} className="bh-card" style={{ padding: "8px 12px" }}>
                <div style={{ fontSize: "0.65rem", color: "var(--muted)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "3px" }}>{m.label}</div>
                <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: "0.9rem" }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 3개월 최고/최저 배너 ─────────────────────── */}
      {ohlcv3m.length > 0 && curPrice > 0 && (
        <div style={{
          display: "flex",
          gap: 0,
          border: "1px solid var(--border)",
          borderBottom: "none",
          background: "#EDE8DC",
          flexWrap: "wrap",
          marginBottom: 0,
        }}>
          {/* 최고가 */}
          <div style={{ flex: "1 1 120px", padding: "8px 14px", borderRight: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.58rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 700 }}>3개월 최고가</div>
            <div style={{ fontFamily: "var(--mono)", fontWeight: 800, color: "#B5453F", fontSize: "0.9rem" }}>
              {h3m.toLocaleString()}원
              <span style={{ fontWeight: 500, fontSize: "0.75rem", marginLeft: "6px" }}>
                ({pctH3m > 0 ? "+" : ""}{pctH3m.toFixed(1)}%)
              </span>
            </div>
          </div>
          {/* 최저가 */}
          <div style={{ flex: "1 1 120px", padding: "8px 14px", borderRight: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.58rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 700 }}>3개월 최저가</div>
            <div style={{ fontFamily: "var(--mono)", fontWeight: 800, color: "#436B95", fontSize: "0.9rem" }}>
              {l3m.toLocaleString()}원
              <span style={{ fontWeight: 500, fontSize: "0.75rem", marginLeft: "6px" }}>
                ({pctL3m > 0 ? "+" : ""}{pctL3m.toFixed(1)}%)
              </span>
            </div>
          </div>
          {/* 등락폭 */}
          <div style={{ flex: "1 1 120px", padding: "8px 14px", borderRight: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.58rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 700 }}>3개월 등락폭</div>
            <div style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: "0.9rem" }}>
              {h3m > 0 && l3m > 0 ? `${((h3m - l3m) / l3m * 100).toFixed(1)}%` : "-"}
            </div>
          </div>
          {/* 현재가 위치 게이지 */}
          <div style={{ flex: "2 1 200px", padding: "8px 14px" }}>
            <div style={{ fontSize: "0.58rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 700, marginBottom: "4px" }}>
              현재가 위치 (저점→고점)
            </div>
            <div style={{ position: "relative", height: "8px", background: "linear-gradient(to right, #436B95, #BCB09A, #B5453F)", borderRadius: "4px" }}>
              <div style={{
                position: "absolute",
                left: hl3mWidth,
                top: "-3px",
                width: "14px",
                height: "14px",
                background: "#B0883A",
                border: "2px solid #FFF",
                borderRadius: "50%",
                transform: "translateX(-50%)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", color: "var(--muted)", marginTop: "3px" }}>
              <span>저점</span>
              <span style={{ color: "#B0883A", fontWeight: 700 }}>{hl3mRange.toFixed(0)}%</span>
              <span>고점</span>
            </div>
          </div>
        </div>
      )}

      {/* ── 기간 버튼 ─────────────────────────────────── */}
      <div style={{
        display: "flex", gap: "4px", marginBottom: "8px", flexWrap: "wrap",
        padding: "6px 8px",
        background: "#F5F0E6",
        border: "1px solid var(--border)",
        borderTop: ohlcv3m.length > 0 ? "none" : undefined,
      }}>
        <span style={{ fontSize: "0.65rem", color: "var(--muted)", fontWeight: 700, alignSelf: "center", marginRight: "4px", letterSpacing: "0.06em" }}>기간</span>
        {PERIODS.map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              padding: "4px 12px",
              background: period === p ? "var(--blue)" : "transparent",
              color: period === p ? "#fff" : "var(--muted)",
              border: `1px solid ${period === p ? "var(--blue)" : "var(--border)"}`,
              fontWeight: 700, fontSize: "0.78rem", cursor: "pointer",
              transition: "all 0.12s",
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* ── 캔들 차트 ────────────────────────────────── */}
      <div className="bh-card" style={{ padding: "12px" }}>
        {loading ? (
          <div style={{ height: "400px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
            차트 로딩 중...
          </div>
        ) : (
          <TradingChart data={ohlcv} />
        )}
      </div>

      {/* ── 신호 요약 패널 (초보자 친화) ──────────────── */}
      {signals && !loading && (
        <div style={{ marginTop: "10px" }}>
          <div style={{
            fontSize: "0.62rem", letterSpacing: "0.16em", textTransform: "uppercase",
            color: "var(--muted)", fontWeight: 700, marginBottom: "6px", paddingLeft: "2px",
          }}>
            차트 신호 요약 — 초보자 가이드
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            <SigCard
              title="이동평균 배열"
              value={signals.maTrend}
              valueColor={signals.maTrendColor}
              desc="MA5 > MA20 > MA60이면 정배열(상승 구조), 반대면 역배열(하락 구조)입니다."
              badge="MA"
            />
            <SigCard
              title="크로스 신호 (최근 30일)"
              value={signals.crossSignal}
              valueColor={signals.crossColor}
              desc={signals.crossDesc}
              badge="이평"
            />
            <SigCard
              title="RSI 과매수/과매도"
              value={signals.rsiStatus}
              valueColor={signals.rsiColor}
              desc={signals.rsiDesc || "RSI 데이터 없음"}
              badge="RSI"
            />
            <SigCard
              title="MACD 추세 방향"
              value={signals.macdStatus}
              valueColor={signals.macdColor}
              desc={signals.macdDesc || "MACD 데이터 없음"}
              badge="MACD"
            />
          </div>
        </div>
      )}

      {/* ── 지표 설명 (초보자용) ────────────────────── */}
      <details style={{ marginTop: "12px" }}>
        <summary style={{
          cursor: "pointer",
          fontSize: "0.75rem",
          color: "var(--muted)",
          fontWeight: 700,
          letterSpacing: "0.06em",
          padding: "8px 10px",
          background: "#EDE8DC",
          border: "1px solid var(--border)",
          userSelect: "none",
        }}>
          📖 차트 지표 읽는 법 (클릭해서 펼치기)
        </summary>
        <div style={{
          padding: "14px 16px",
          background: "#F5F1EB",
          border: "1px solid var(--border)",
          borderTop: "none",
          fontSize: "0.8rem",
          lineHeight: 1.8,
          color: "var(--fg)",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" }}>
            {[
              {
                title: "🕯 캔들(봉차트)",
                items: [
                  "빨간 봉 = 시가보다 종가가 높은 날 (상승)",
                  "파란 봉 = 시가보다 종가가 낮은 날 (하락)",
                  "긴 봉 = 변동이 컸던 날",
                ],
              },
              {
                title: "📈 이동평균선 (MA)",
                items: [
                  "MA5 (금색) = 최근 5일 평균가 — 단기 추세",
                  "MA20 (파랑) = 최근 20일 평균가 — 중기 추세",
                  "MA60 (빨강) = 최근 60일 평균가 — 장기 추세",
                  "주가가 MA 위 = 그 기간보다 비쌈 (강세)",
                ],
              },
              {
                title: "🟡 골든/데드크로스",
                items: [
                  "골든크로스 ▲ = MA5가 MA20을 위로 돌파 → 매수 신호",
                  "데드크로스 ▼ = MA5가 MA20을 아래로 돌파 → 매도 신호",
                  "단독 신호로만 판단하지 말고 거래량 등 함께 확인",
                ],
              },
              {
                title: "⚡ RSI",
                items: [
                  "0~100 사이 숫자. 최근 14일 기준",
                  "70 이상 → 너무 많이 올랐을 수 있음 (과매수)",
                  "30 이하 → 너무 많이 떨어졌을 수 있음 (과매도)",
                  "50 근처 = 중립",
                ],
              },
              {
                title: "📊 MACD",
                items: [
                  "막대가 0 위 (빨강) → 매수세 강한 상태",
                  "막대가 0 아래 (파랑) → 매도세 강한 상태",
                  "막대가 커지면 추세가 강해지는 중",
                  "MACD선이 시그널선 위로 = 매수 신호",
                ],
              },
              {
                title: "📉 볼린저밴드",
                items: [
                  "상단선 접근 = 단기 과매수 가능성",
                  "하단선 접근 = 단기 과매도, 반등 기대",
                  "밴드 폭이 좁아지면 큰 움직임 예고",
                ],
              },
            ].map(({ title, items }) => (
              <div key={title}>
                <div style={{ fontWeight: 800, marginBottom: "5px", color: "var(--blue-deep)" }}>{title}</div>
                <ul style={{ margin: 0, paddingLeft: "18px" }}>
                  {items.map(it => <li key={it} style={{ marginBottom: "2px" }}>{it}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
