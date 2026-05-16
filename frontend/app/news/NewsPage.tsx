"use client";

import { useEffect, useState } from "react";
import { apiNews, apiNewsRefresh, type NewsItem } from "@/lib/api";

function timeAgo(iso: string): string {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

function scoreAccent(score: number): string {
  if (score >= 4) return "var(--purple-deep)";
  if (score >= 2) return "var(--purple)";
  return "transparent";
}

function NewsCard({ item }: { item: NewsItem }) {
  const isKR = item.region === "KR";
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--line)",
          borderLeft: `3px solid ${scoreAccent(item.score)}`,
          transition: "background 160ms ease",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--purple-pale)")}
        onMouseLeave={e => (e.currentTarget.style.background = "")}
        title={`중요도 ${item.score}`}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              title={item.title_orig}
              style={{
                fontFamily: "var(--maru)", fontWeight: 700, fontSize: "0.95rem",
                lineHeight: 1.4, letterSpacing: "-0.2px",
                color: "var(--ink)", marginBottom: "6px",
                overflow: "hidden", display: "-webkit-box",
                WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              }}
            >
              {item.title}
            </div>
            {item.desc && (
              <div style={{
                fontSize: "0.8rem", color: "var(--ink-muted)", lineHeight: 1.5,
                overflow: "hidden", display: "-webkit-box",
                WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                marginBottom: "8px",
              }}>
                {item.desc}
              </div>
            )}
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <span style={{
                fontSize: "0.68rem", fontWeight: 600,
                color: isKR ? "var(--purple)" : "var(--ink-muted)",
                background: isKR ? "var(--purple-subtle)" : "rgba(104,107,130,0.12)",
                padding: "2px 8px",
                borderRadius: "6px",
              }}>
                {isKR ? "국내" : "글로벌"}
              </span>
              <span style={{ fontSize: "0.72rem", color: "var(--ink-soft)", fontWeight: 500 }}>
                {item.source}
              </span>
              <span style={{ fontSize: "0.7rem", color: "var(--ink-soft)", marginLeft: "auto" }}>
                {timeAgo(item.published)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}

export default function NewsPage() {
  const [items, setItems]       = useState<NewsItem[]>([]);
  const [cachedAt, setCachedAt] = useState("");
  const [loading, setLoading]   = useState(true);
  const [region, setRegion]     = useState<"ALL" | "KR" | "GLOBAL">("ALL");
  const [refreshing, setRefreshing] = useState(false);

  const load = (r = region) => {
    setLoading(true);
    apiNews({ limit: 60, region: r })
      .then(res => { setItems(res.items); setCachedAt(res.cached_at); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [region]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await apiNewsRefresh();
    await new Promise(r => setTimeout(r, 500));
    load();
    setRefreshing(false);
  };

  const kr     = items.filter(i => i.region === "KR");
  const global = items.filter(i => i.region === "GLOBAL");
  const display = region === "KR" ? kr : region === "GLOBAL" ? global : items;

  const tabs: Array<{ key: typeof region; label: string }> = [
    { key: "ALL",    label: `전체 ${items.length}` },
    { key: "KR",     label: `국내 ${kr.length}` },
    { key: "GLOBAL", label: `글로벌 ${global.length}` },
  ];

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <h1 style={{
          fontFamily: "var(--maru)", color: "var(--ink)",
          fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.5px",
          margin: 0,
        }}>
          오늘의 증시 뉴스
        </h1>
        {cachedAt && (
          <span style={{ fontSize: "0.72rem", color: "var(--ink-soft)" }}>
            {timeAgo(cachedAt)} 갱신
          </span>
        )}
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          style={{
            marginLeft: "auto", padding: "8px 14px",
            background: "var(--surface)",
            border: "1px solid var(--purple-dark)",
            color: "var(--purple-dark)",
            fontSize: "0.78rem", fontWeight: 600,
            borderRadius: "12px", cursor: "pointer",
            transition: "background 160ms ease",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--purple-pale)")}
          onMouseLeave={e => (e.currentTarget.style.background = "var(--surface)")}
        >
          {refreshing ? "새로고침 중..." : "새로고침"}
        </button>
      </div>

      {/* 필터 탭 */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
        {tabs.map(t => {
          const on = region === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setRegion(t.key)}
              style={{
                padding: "8px 16px",
                background: on ? "var(--purple)" : "var(--surface)",
                color: on ? "#fff" : "var(--ink-muted)",
                border: `1px solid ${on ? "var(--purple)" : "var(--line)"}`,
                fontWeight: 600, fontSize: "0.8rem", cursor: "pointer",
                borderRadius: "12px",
                transition: "all 160ms ease",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 중요도 범례 */}
      <div style={{
        display: "flex", gap: "16px", alignItems: "center",
        padding: "8px 14px", background: "var(--purple-pale)",
        border: "1px solid var(--line-soft)",
        borderRadius: "10px",
        marginBottom: "12px",
        fontSize: "0.72rem", color: "var(--ink-muted)",
      }}>
        <span style={{ fontWeight: 600 }}>중요도</span>
        {[
          { color: "var(--purple-deep)", label: "높음" },
          { color: "var(--purple)",      label: "중간" },
          { color: undefined,            label: "보통" },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{
              width: "3px", height: "14px", display: "inline-block",
              borderRadius: "2px",
              ...(color ? { background: color } : { border: "1px solid var(--ink-soft)" }),
            }} />
            {label}
          </span>
        ))}
      </div>

      {/* 뉴스 목록 */}
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "16px",
        boxShadow: "rgba(0,0,0,0.03) 0px 4px 24px",
        overflow: "hidden",
      }}>
        {loading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--ink-soft)" }}>
            뉴스를 불러오는 중...
          </div>
        ) : display.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--ink-soft)" }}>
            증시 관련 뉴스를 찾지 못했습니다.
          </div>
        ) : (
          display.map((item, i) => <NewsCard key={i} item={item} />)
        )}
      </div>
    </div>
  );
}
