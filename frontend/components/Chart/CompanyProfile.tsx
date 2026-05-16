"use client";

import { useEffect, useState } from "react";
import { apiProfile, apiSentiment, type StockProfile, type NewsSentiment } from "@/lib/api";

interface Props {
  code: string;
}

// ── 디자인 토큰 ─────────────────────────────────────────────────────────
// 퍼플 슬라임 카드 패턴:
//   - 카드: var(--surface) + 1px var(--line) + 16px radius + soft shadow
//   - 상단 3px 색 보더로 카테고리 구분 (시장 신호는 red/blue 유지)
//   - 라벨: 0.62rem · 0.12em letter-spacing · uppercase · var(--ink-muted) · 700
//   - 숫자: var(--mono) · 800
const COLOR_DIVIDEND = "var(--purple)";     // 배당 — 카테고리 표식 (퍼플)
const COLOR_FLOW     = "var(--purple-dark)";// 수급 — 카테고리 표식 (퍼플 다크)
const COLOR_INDIV    = "var(--purple)";     // 외국인 지분율 카드 표식
const COLOR_SENT_POS = "var(--red)";        // 센티먼트 긍정 = 상승
const COLOR_SENT_NEG = "var(--blue)";       // 센티먼트 부정 = 하락
const COLOR_SENT_NEU = "var(--ink-muted)";  // 센티먼트 중립

// ── 공통: 카드 셸 ───────────────────────────────────────────────────────
function ProfileCard({
  title,
  badge,
  accent,
  children,
}: {
  title: string;
  badge?: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderTop: `3px solid ${accent}`,
        borderRadius: "14px",
        boxShadow: "rgba(0,0,0,0.03) 0px 4px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        minHeight: "150px",
      }}
    >
      <div
        style={{
          fontSize: "0.62rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--ink-muted)",
          fontWeight: 700,
        }}
      >
        {title}
        {badge && (
          <span
            style={{
              background: "var(--purple-pale)",
              color: "var(--purple-deep)",
              padding: "1px 6px",
              fontSize: "0.58rem",
              fontWeight: 800,
              marginLeft: "6px",
              borderRadius: "4px",
            }}
          >
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ── 회사 개요 ───────────────────────────────────────────────────────────
function OverviewCard({ profile }: { profile: StockProfile }) {
  const [expanded, setExpanded] = useState(false);
  const o = profile.overview;
  const metaItems = [
    o.industry && { label: "업종", value: o.industry },
    o.established && { label: "설립", value: o.established },
    o.ceo && { label: "대표", value: o.ceo },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div
      style={{
        padding: "16px 18px",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderTop: "3px solid var(--purple)",
        borderRadius: "14px",
        boxShadow: "rgba(0,0,0,0.03) 0px 4px 16px",
        marginBottom: "10px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "10px",
          flexWrap: "wrap",
          marginBottom: "8px",
        }}
      >
        <div
          style={{
            fontSize: "0.62rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--ink-muted)",
            fontWeight: 700,
          }}
        >
          회사 개요
          <span
            style={{
              background: o.source === "DART" ? "var(--purple-pale)" : "var(--surface-2)",
              color: o.source === "DART" ? "var(--purple-deep)" : "var(--ink-muted)",
              padding: "1px 6px",
              fontSize: "0.58rem",
              fontWeight: 800,
              marginLeft: "6px",
              borderRadius: "4px",
              border: o.source === "DART" ? "none" : "1px dashed var(--line)",
            }}
            title={o.source === "DART" ? "DART 공시 기준" : "DART API 키 발급 전 — 임시 데이터"}
          >
            {o.source === "DART" ? "DART" : "MOCK"}
          </span>
        </div>
        {o.homepage && (
          <a
            href={o.homepage}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "0.72rem",
              color: "var(--purple-deep)",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            홈페이지
          </a>
        )}
      </div>

      <div
        style={{
          fontSize: "0.86rem",
          lineHeight: 1.7,
          color: "var(--ink)",
          marginBottom: "10px",
          display: "-webkit-box",
          WebkitLineClamp: expanded ? "unset" : 3,
          WebkitBoxOrient: "vertical" as const,
          overflow: "hidden",
        }}
      >
        {o.summary}
      </div>

      {o.summary.length > 120 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            alignSelf: "flex-start",
            background: "transparent",
            border: "none",
            color: "var(--purple-deep)",
            fontSize: "0.74rem",
            fontWeight: 700,
            cursor: "pointer",
            padding: 0,
            marginBottom: "8px",
            letterSpacing: "0.04em",
          }}
        >
          {expanded ? "접기" : "더보기"}
        </button>
      )}

      {metaItems.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "10px",
            paddingTop: "12px",
            borderTop: "1px solid var(--line)",
          }}
        >
          {metaItems.map((m) => (
            <div key={m.label}>
              <div
                style={{
                  fontSize: "0.58rem",
                  color: "var(--ink-muted)",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: "2px",
                }}
              >
                {m.label}
              </div>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--ink)" }}>
                {m.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 배당 카드 ───────────────────────────────────────────────────────────
function DividendCard({ profile }: { profile: StockProfile }) {
  const d = profile.dividend;
  const hasDividend = d.per_share > 0 || d.yield_pct > 0;

  return (
    <ProfileCard
      title="배당"
      badge={d.source === "DART" ? "DART" : "MOCK"}
      accent={COLOR_DIVIDEND}
    >
      {hasDividend ? (
        <>
          <div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontWeight: 800,
                fontSize: "1.4rem",
                color: COLOR_DIVIDEND,
                lineHeight: 1.1,
              }}
            >
              {d.yield_pct.toFixed(2)}%
            </div>
            <div style={{ fontSize: "0.66rem", color: "var(--muted)", marginTop: "2px" }}>
              시가배당률
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "6px",
              paddingTop: "6px",
              borderTop: "1px dashed var(--border)",
            }}
          >
            <div>
              <div style={{ fontSize: "0.58rem", color: "var(--muted)", fontWeight: 700, letterSpacing: "0.06em" }}>
                주당
              </div>
              <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: "0.82rem" }}>
                {d.per_share.toLocaleString()}원
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.58rem", color: "var(--muted)", fontWeight: 700, letterSpacing: "0.06em" }}>
                기준연도
              </div>
              <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: "0.82rem" }}>
                {d.fiscal_year || "-"}
              </div>
            </div>
          </div>
          {d.payout_ratio > 0 && (
            <div style={{ fontSize: "0.68rem", color: "var(--muted)" }}>
              배당성향 <span style={{ color: "var(--fg)", fontWeight: 700 }}>{d.payout_ratio.toFixed(1)}%</span>
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: "0.78rem", color: "var(--muted)", fontStyle: "italic", margin: "auto 0" }}>
          최근 배당 내역이 없습니다.
        </div>
      )}
    </ProfileCard>
  );
}

// ── 수급 카드 (20일 누적 + 미니 막대) ────────────────────────────────────
function InvestorFlowCard({ profile }: { profile: StockProfile }) {
  const f = profile.investor_flow;
  const max = Math.max(
    1,
    Math.abs(f.foreign_sum),
    Math.abs(f.institution_sum),
    Math.abs(f.individual_sum),
  );

  const rows = [
    { key: "외국인", value: f.foreign_sum, color: "#436B95" },
    { key: "기관",   value: f.institution_sum, color: "var(--blue-deep)" },
    { key: "개인",   value: f.individual_sum, color: "#B5453F" },
  ];

  return (
    <ProfileCard
      title={`수급 (최근 ${f.days}영업일)`}
      badge={f.source}
      accent={COLOR_FLOW}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
        {rows.map((r) => {
          const pct = (Math.abs(r.value) / max) * 100;
          const positive = r.value >= 0;
          return (
            <div key={r.key}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.7rem",
                  marginBottom: "2px",
                }}
              >
                <span style={{ color: "var(--muted)", fontWeight: 700, letterSpacing: "0.04em" }}>
                  {r.key}
                </span>
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontWeight: 800,
                    color: positive ? "#B5453F" : "#436B95",
                  }}
                >
                  {positive ? "+" : ""}
                  {r.value.toLocaleString()}억
                </span>
              </div>
              <div style={{ position: "relative", height: "6px", background: "var(--surf2)" }}>
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    height: "100%",
                    width: `${pct}%`,
                    background: r.color,
                    opacity: 0.85,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </ProfileCard>
  );
}

// ── 보유 구성 게이지 (외국인 지분율 중심) ────────────────────────────────
function HoldingCard({ profile }: { profile: StockProfile }) {
  const foreign = Math.min(100, Math.max(0, profile.investor_flow.foreign_ratio));
  // 기관/개인 비율은 공식 데이터 없음 — 외국인 외 잔여를 균등 분할 표기 + 안내
  const remainder = Math.max(0, 100 - foreign);

  return (
    <ProfileCard title="외국인 지분율" badge="KIS" accent={COLOR_INDIV}>
      <div>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontWeight: 800,
            fontSize: "1.4rem",
            color: COLOR_INDIV,
            lineHeight: 1.1,
          }}
        >
          {foreign.toFixed(2)}%
        </div>
        <div style={{ fontSize: "0.66rem", color: "var(--muted)", marginTop: "2px" }}>
          외국인 보유 비중
        </div>
      </div>

      <div>
        <div
          style={{
            display: "flex",
            height: "10px",
            border: "1px solid var(--border)",
            overflow: "hidden",
          }}
        >
          <div style={{ width: `${foreign}%`, background: "#436B95" }} title={`외국인 ${foreign.toFixed(1)}%`} />
          <div style={{ width: `${remainder}%`, background: "var(--surf2)" }} title={`내국인 ${remainder.toFixed(1)}%`} />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.6rem",
            color: "var(--muted)",
            marginTop: "4px",
          }}
        >
          <span style={{ color: "#436B95", fontWeight: 700 }}>외국인 {foreign.toFixed(1)}%</span>
          <span>내국인 {remainder.toFixed(1)}%</span>
        </div>
      </div>

      <div style={{ fontSize: "0.66rem", color: "var(--muted)", lineHeight: 1.5, fontStyle: "italic" }}>
        기관/개인 세부 비율은 DART 키 발급 후 추가 예정
      </div>
    </ProfileCard>
  );
}

// ── 뉴스 센티먼트 카드 ──────────────────────────────────────────────────
function SentimentCard({ sentiment }: { sentiment: NewsSentiment | null }) {
  if (!sentiment) {
    return (
      <ProfileCard title="뉴스 분위기" badge="…" accent={COLOR_SENT_NEU}>
        <div style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "auto 0" }}>
          뉴스 분석 중…
        </div>
      </ProfileCard>
    );
  }

  const { score, label, summary, source, news_count, headlines } = sentiment;
  // 색상: 라벨 우선 (점수 미세 변동 무시)
  const accent =
    label === "긍정" ? COLOR_SENT_POS :
    label === "부정" ? COLOR_SENT_NEG :
    COLOR_SENT_NEU;

  // -1~+1 → 0~100% 위치 (게이지)
  const pos = Math.min(100, Math.max(0, (score + 1) * 50));

  const badge =
    source === "LLM" ? "AI" :
    source === "KEYWORD" ? "키워드" :
    "데이터없음";

  return (
    <ProfileCard title={`뉴스 분위기 (최근 ${news_count}건)`} badge={badge} accent={accent}>
      <div>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontWeight: 800,
            fontSize: "1.4rem",
            color: accent,
            lineHeight: 1.1,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: "0.66rem", color: "var(--muted)", marginTop: "2px" }}>
          종합 센티먼트 ({score >= 0 ? "+" : ""}
          {score.toFixed(2)})
        </div>
      </div>

      {/* -1 ↔ 0 ↔ +1 게이지 */}
      <div>
        <div
          style={{
            position: "relative",
            height: "8px",
            background: "linear-gradient(to right, #436B95, var(--surf2) 50%, #B5453F)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: `${pos}%`,
              top: "-3px",
              width: "12px",
              height: "12px",
              background: accent,
              border: "2px solid #FFF",
              borderRadius: "50%",
              transform: "translateX(-50%)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.58rem",
            color: "var(--muted)",
            marginTop: "3px",
          }}
        >
          <span>부정</span>
          <span>중립</span>
          <span>긍정</span>
        </div>
      </div>

      <div style={{ fontSize: "0.72rem", color: "var(--fg)", lineHeight: 1.55 }}>
        {summary}
      </div>

      {headlines.length > 0 && (
        <div
          style={{
            paddingTop: "6px",
            borderTop: "1px dashed var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: "3px",
          }}
        >
          {headlines.slice(0, 2).map((h, i) => (
            <a
              key={i}
              href={h.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "0.7rem",
                color: "var(--purple-deep)",
                textDecoration: "none",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontWeight: 600,
              }}
              title={h.title}
            >
              · {h.title}
            </a>
          ))}
        </div>
      )}

      {source !== "LLM" && (
        <div
          style={{
            fontSize: "0.62rem",
            color: "var(--muted)",
            fontStyle: "italic",
            lineHeight: 1.4,
          }}
        >
          {source === "EMPTY"
            ? "관련 뉴스가 수집되지 않아 분석할 수 없습니다."
            : "AI 분석 미연결 — 키워드 빈도 기반 단순 점수입니다."}
        </div>
      )}
    </ProfileCard>
  );
}

// ── 메인 컴포넌트 ───────────────────────────────────────────────────────
export default function CompanyProfile({ code }: Props) {
  const [profile, setProfile] = useState<StockProfile | null>(null);
  const [sentiment, setSentiment] = useState<NewsSentiment | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    setSentiment(null);
    apiProfile(code)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
    // 센티먼트는 LLM 호출이 느릴 수 있어 별도 비동기 — 프로필 카드는 먼저 떠야 함
    apiSentiment(code)
      .then(setSentiment)
      .catch(() => setSentiment(null));
  }, [code]);

  if (loading && !profile) {
    return (
      <div
        style={{
          padding: "16px",
          background: "var(--surf)",
          border: "1px solid var(--border)",
          color: "var(--muted)",
          fontSize: "0.8rem",
          marginBottom: "10px",
        }}
      >
        회사 정보 불러오는 중…
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div style={{ marginBottom: "12px" }}>
      <OverviewCard profile={profile} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "8px",
        }}
      >
        <DividendCard profile={profile} />
        <InvestorFlowCard profile={profile} />
        <HoldingCard profile={profile} />
        <SentimentCard sentiment={sentiment} />
      </div>
    </div>
  );
}
