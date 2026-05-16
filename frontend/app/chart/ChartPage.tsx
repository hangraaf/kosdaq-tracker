"use client";

import { useEffect, useRef, useState } from "react";
import {
  apiChart, apiSnapshot,
  type OHLCVRow, type StockSnapshot,
} from "@/lib/api";
import LiveBadge from "@/components/LiveBadge";
import TradingChart from "@/components/Chart/TradingChart";
import CompanyProfile from "@/components/Chart/CompanyProfile";
import GuruPage from "@/app/guru/GuruPage";
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
  let maTrend = "혼조", maTrendColor = "var(--ink-muted)";
  if (lm5 && lm20 && lm60) {
    if (last > lm5 && lm5 > lm20 && lm20 > lm60) {
      maTrend = "정배열 (상승)"; maTrendColor = "var(--red)";
    } else if (last < lm5 && lm5 < lm20 && lm20 < lm60) {
      maTrend = "역배열 (하락)"; maTrendColor = "var(--blue)";
    }
  }

  // 골든/데드크로스 최근 감지
  let crossSignal = "없음", crossColor = "var(--ink-muted)";
  let crossDesc = "MA5와 MA20이 교차하지 않았습니다.";
  for (let i = ohlcv.length - 1; i >= Math.max(0, ohlcv.length - 30); i--) {
    const p5 = ma5[i - 1], p20 = ma20[i - 1], c5 = ma5[i], c20 = ma20[i];
    if (p5 === null || p20 === null || c5 === null || c20 === null) continue;
    if (p5 < p20 && c5 >= c20) {
      crossSignal = "골든크로스"; crossColor = "var(--purple)";
      crossDesc = "MA5가 MA20 위로 돌파 — 단기 상승 전환 신호입니다.";
      break;
    }
    if (p5 > p20 && c5 <= c20) {
      crossSignal = "데드크로스"; crossColor = "var(--blue)";
      crossDesc = "MA5가 MA20 아래로 돌파 — 단기 하락 전환 신호입니다.";
      break;
    }
  }

  // RSI (직접 계산)
  const rsiArr = rsiCalc(closes);
  const lastRsi = rsiArr[rsiArr.length - 1];
  let rsiStatus = "-", rsiColor = "var(--ink-muted)", rsiDesc = "";
  if (lastRsi !== null) {
    if (lastRsi >= 70) {
      rsiStatus = `${lastRsi.toFixed(0)} 과매수 주의`; rsiColor = "var(--red)";
      rsiDesc = "RSI 70 이상 — 단기 고점 가능성, 신중하게 접근하세요.";
    } else if (lastRsi <= 30) {
      rsiStatus = `${lastRsi.toFixed(0)} 과매도 반등 기대`; rsiColor = "var(--blue)";
      rsiDesc = "RSI 30 이하 — 과도 하락, 반등을 기대해볼 수 있습니다.";
    } else {
      rsiStatus = `${lastRsi.toFixed(0)} 중립`; rsiColor = "var(--ink)";
      rsiDesc = "RSI 30~70 중립 구간입니다.";
    }
  }

  // MACD (직접 계산)
  const { hist } = macdCalc(closes);
  const lastHist = hist[hist.length - 1] ?? null;
  const prevHist = hist[hist.length - 2] ?? null;
  let macdStatus = "-", macdColor = "var(--ink-muted)", macdDesc = "";
  if (lastHist !== null) {
    const growing = prevHist !== null && lastHist > prevHist;
    if (lastHist > 0) {
      macdStatus = growing ? "상승세 강화" : "매수세 우세"; macdColor = "var(--red)";
      macdDesc = "MACD 막대가 0선 위 — 매수세 우세 상태입니다.";
    } else {
      macdStatus = growing ? "하락세 약화" : "매도세 우세"; macdColor = "var(--blue)";
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
      padding: "12px 16px",
      background: "var(--surface)",
      border: "1px solid var(--line)",
      borderTop: `3px solid ${valueColor}`,
      borderRadius: "12px",
      boxShadow: "rgba(16,24,40,0.04) 0px 1px 4px",
    }}>
      <div style={{ fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-soft)", fontWeight: 600, marginBottom: "6px" }}>
        {title} {badge && <span style={{ background: "var(--purple-subtle)", color: "var(--purple)", padding: "1px 6px", fontSize: "0.58rem", fontWeight: 700, marginLeft: "4px", borderRadius: "6px" }}>{badge}</span>}
      </div>
      <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: "0.92rem", color: valueColor, marginBottom: "6px" }}>
        {value}
      </div>
      <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)", lineHeight: 1.5 }}>
        {desc}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: "16px",
  boxShadow: "rgba(0,0,0,0.03) 0px 4px 24px",
};

const WS_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")
  .replace(/^http/, "ws");

export default function ChartPage() {
  const { selectedCode, period, setPeriod } = useUIStore();
  const [snap, setSnap]       = useState<StockSnapshot | null>(null);
  const [ohlcv, setOhlcv]     = useState<OHLCVRow[]>([]);
  const [ohlcv3m, setOhlcv3m] = useState<OHLCVRow[]>([]);
  const [isLive, setIsLive]   = useState(false);
  const [loading, setLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // 초기 데이터 로드
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

  // KIS WebSocket 실시간 가격 스트리밍
  useEffect(() => {
    if (!selectedCode) return;

    const connectWs = () => {
      const ws = new WebSocket(`${WS_BASE}/stocks/ws/${selectedCode}`);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.ping || data.error) return;
          setSnap(prev => prev ? {
            ...prev,
            price:       data.price       ?? prev.price,
            change:      data.change      ?? prev.change,
            change_rate: data.change_rate ?? prev.change_rate,
            volume:      data.volume      ?? prev.volume,
          } : prev);
          setIsLive(true);
        } catch { /* ignore */ }
      };

      ws.onerror = () => ws.close();
      ws.onclose = () => {
        wsRef.current = null;
      };
    };

    connectWs();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [selectedCode]);

  // REST 폴링 — WS 미사용 시 또는 장중 보조 새로고침 (10초)
  useEffect(() => {
    if (!selectedCode) return;
    const id = setInterval(async () => {
      try {
        const s = await apiSnapshot(selectedCode);
        setSnap(s);
      } catch { /* ignore */ }
    }, 10_000);
    return () => clearInterval(id);
  }, [selectedCode]);

  if (!selectedCode) {
    return (
      <div style={{ ...cardStyle, padding: "72px 24px", textAlign: "center", maxWidth: "500px", margin: "0 auto" }}>
        <div style={{ fontFamily: "var(--maru)", fontSize: "1.05rem", color: "var(--ink)", fontWeight: 600, marginBottom: "8px" }}>
          종목을 선택해주세요
        </div>
        <div style={{ fontSize: "0.86rem", color: "var(--ink-soft)" }}>
          종목 탭에서 종목을 선택하면 차트가 표시됩니다.
        </div>
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
            <h1 style={{
              fontFamily: "var(--maru)", color: "var(--ink)",
              fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.5px",
              margin: 0,
            }}>
              {snap.name}
            </h1>
            <span style={{ color: "var(--ink-soft)", fontSize: "0.85rem" }}>{snap.code} · {snap.market}</span>
            <LiveBadge live={isLive} />
          </div>

          {/* 현재가 + 등락 */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: "14px", marginTop: "8px", flexWrap: "wrap" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: "1.85rem", fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.5px" }}>
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
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: "8px",
            marginTop: "12px",
          }}>
            {[
              { label: "거래량",   value: snap.volume.toLocaleString() },
              { label: "시가총액", value: snap.market_cap >= 1e12 ? `${(snap.market_cap / 1e12).toFixed(1)}조` : `${(snap.market_cap / 1e8).toFixed(0)}억` },
              { label: "업종",     value: snap.sector },
              { label: "시장",     value: snap.market },
            ].map(m => (
              <div key={m.label} style={{
                ...cardStyle,
                padding: "10px 14px",
                boxShadow: "rgba(16,24,40,0.04) 0px 1px 4px",
              }}>
                <div style={{ fontSize: "0.66rem", color: "var(--ink-soft)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "4px" }}>{m.label}</div>
                <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: "0.92rem", color: "var(--ink)" }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 회사 프로필 (개요 + 배당 + 수급 + 외국인 지분율) ── */}
      <CompanyProfile code={selectedCode} />

      {/* ── 3개월 최고/최저 배너 ─────────────────────── */}
      {ohlcv3m.length > 0 && curPrice > 0 && (
        <div style={{
          display: "flex",
          gap: 0,
          border: "1px solid var(--line)",
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderRadius: "12px 12px 0 0",
          borderBottom: "none",
          background: "var(--surface)",
          flexWrap: "wrap",
          marginBottom: 0,
          overflow: "hidden",
        }}>
          {/* 최고가 */}
          <div style={{ flex: "1 1 120px", padding: "10px 14px", borderRight: "1px solid var(--line)" }}>
            <div style={{ fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-soft)", fontWeight: 600 }}>3개월 최고가</div>
            <div style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--red)", fontSize: "0.92rem", marginTop: "2px" }}>
              {h3m.toLocaleString()}원
              <span style={{ fontWeight: 500, fontSize: "0.75rem", marginLeft: "6px" }}>
                ({pctH3m > 0 ? "+" : ""}{pctH3m.toFixed(1)}%)
              </span>
            </div>
          </div>
          {/* 최저가 */}
          <div style={{ flex: "1 1 120px", padding: "10px 14px", borderRight: "1px solid var(--line)" }}>
            <div style={{ fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-soft)", fontWeight: 600 }}>3개월 최저가</div>
            <div style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--blue)", fontSize: "0.92rem", marginTop: "2px" }}>
              {l3m.toLocaleString()}원
              <span style={{ fontWeight: 500, fontSize: "0.75rem", marginLeft: "6px" }}>
                ({pctL3m > 0 ? "+" : ""}{pctL3m.toFixed(1)}%)
              </span>
            </div>
          </div>
          {/* 등락폭 */}
          <div style={{ flex: "1 1 120px", padding: "10px 14px", borderRight: "1px solid var(--line)" }}>
            <div style={{ fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-soft)", fontWeight: 600 }}>3개월 등락폭</div>
            <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: "0.92rem", color: "var(--ink)", marginTop: "2px" }}>
              {h3m > 0 && l3m > 0 ? `${((h3m - l3m) / l3m * 100).toFixed(1)}%` : "-"}
            </div>
          </div>
          {/* 현재가 위치 게이지 */}
          <div style={{ flex: "2 1 200px", padding: "10px 14px" }}>
            <div style={{ fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-soft)", fontWeight: 600, marginBottom: "6px" }}>
              현재가 위치 (저점→고점)
            </div>
            <div style={{ position: "relative", height: "8px", background: "linear-gradient(to right, var(--blue), var(--line), var(--red))", borderRadius: "4px" }}>
              <div style={{
                position: "absolute",
                left: hl3mWidth,
                top: "-3px",
                width: "14px",
                height: "14px",
                background: "var(--purple)",
                border: "2px solid #fff",
                borderRadius: "50%",
                transform: "translateX(-50%)",
                boxShadow: "0 1px 4px rgba(113,50,245,0.4)",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.62rem", color: "var(--ink-soft)", marginTop: "4px" }}>
              <span>저점</span>
              <span style={{ color: "var(--purple)", fontWeight: 700 }}>{hl3mRange.toFixed(0)}%</span>
              <span>고점</span>
            </div>
          </div>
        </div>
      )}

      {/* ── 기간 버튼 ─────────────────────────────────── */}
      <div style={{
        display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap",
        padding: "8px 10px",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: ohlcv3m.length > 0 ? "0" : "12px",
        borderTop: ohlcv3m.length > 0 ? "none" : undefined,
        alignItems: "center",
      }}>
        <span style={{ fontSize: "0.66rem", color: "var(--ink-soft)", fontWeight: 600, marginRight: "4px", letterSpacing: "0.04em" }}>기간</span>
        {PERIODS.map(p => {
          const on = period === p;
          return (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: "6px 14px",
                background: on ? "var(--purple)" : "var(--surface)",
                color: on ? "#fff" : "var(--ink-muted)",
                border: `1px solid ${on ? "var(--purple)" : "var(--line)"}`,
                fontWeight: 600, fontSize: "0.78rem", cursor: "pointer",
                borderRadius: "10px",
                transition: "all 160ms ease",
              }}
            >
              {p}
            </button>
          );
        })}
      </div>

      {/* ── 캔들 차트 ────────────────────────────────── */}
      <div style={{ ...cardStyle, padding: "14px" }}>
        {loading ? (
          <div style={{ height: "400px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-soft)" }}>
            차트 로딩 중...
          </div>
        ) : (
          <TradingChart data={ohlcv} />
        )}
      </div>

      {/* ── 신호 요약 패널 (초보자 친화) ──────────────── */}
      {signals && !loading && (
        <div style={{ marginTop: "14px" }}>
          <div style={{
            fontSize: "0.66rem", letterSpacing: "0.1em", textTransform: "uppercase",
            color: "var(--ink-soft)", fontWeight: 600, marginBottom: "8px", paddingLeft: "2px",
          }}>
            차트 신호 요약 — 초보자 가이드
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
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
      <details style={{ marginTop: "14px" }}>
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
          차트 지표 읽는 법 (펼쳐서 보기)
        </summary>
        <div style={{
          marginTop: "6px",
          padding: "16px 18px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "12px",
          fontSize: "0.82rem",
          lineHeight: 1.7,
          color: "var(--ink)",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
            {[
              {
                title: "캔들 (봉차트)",
                items: [
                  "빨간 봉 = 시가보다 종가가 높은 날 (상승)",
                  "파란 봉 = 시가보다 종가가 낮은 날 (하락)",
                  "긴 봉 = 변동이 컸던 날",
                ],
              },
              {
                title: "이동평균선 (MA)",
                items: [
                  "MA5 = 최근 5일 평균가 — 단기 추세",
                  "MA20 = 최근 20일 평균가 — 중기 추세",
                  "MA60 = 최근 60일 평균가 — 장기 추세",
                  "주가가 MA 위 = 그 기간보다 비쌈 (강세)",
                ],
              },
              {
                title: "골든·데드 크로스",
                items: [
                  "골든크로스 = MA5가 MA20을 위로 돌파 → 매수 신호",
                  "데드크로스 = MA5가 MA20을 아래로 돌파 → 매도 신호",
                  "단독 신호로만 판단하지 말고 거래량 등 함께 확인",
                ],
              },
              {
                title: "RSI",
                items: [
                  "0~100 사이 숫자. 최근 14일 기준",
                  "70 이상 → 너무 많이 올랐을 수 있음 (과매수)",
                  "30 이하 → 너무 많이 떨어졌을 수 있음 (과매도)",
                  "50 근처 = 중립",
                ],
              },
              {
                title: "MACD",
                items: [
                  "막대가 0 위 → 매수세 강한 상태",
                  "막대가 0 아래 → 매도세 강한 상태",
                  "막대가 커지면 추세가 강해지는 중",
                  "MACD선이 시그널선 위로 = 매수 신호",
                ],
              },
              {
                title: "볼린저밴드",
                items: [
                  "상단선 접근 = 단기 과매수 가능성",
                  "하단선 접근 = 단기 과매도, 반등 기대",
                  "밴드 폭이 좁아지면 큰 움직임 예고",
                ],
              },
            ].map(({ title, items }) => (
              <div key={title}>
                <div style={{ fontFamily: "var(--maru)", fontWeight: 700, marginBottom: "6px", color: "var(--purple)", letterSpacing: "-0.2px" }}>{title}</div>
                <ul style={{ margin: 0, paddingLeft: "18px" }}>
                  {items.map(it => <li key={it} style={{ marginBottom: "2px" }}>{it}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </details>

      {/* ── 투자 대가 조언 ────────────────────────────── */}
      <div style={{ marginTop: "28px", borderTop: "1px solid var(--line)", paddingTop: "24px" }}>
        <GuruPage />
      </div>
    </div>
  );
}
