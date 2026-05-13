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

function ScoreDot({ score }: { score: number }) {
  const color = score >= 4 ? "#B5453F" : score >= 2 ? "#B0883A" : "var(--muted)";
  return (
    <span title={`관련도 ${score}`} style={{
      display: "inline-block", width: "8px", height: "8px",
      borderRadius: "50%", background: color, marginRight: "5px", flexShrink: 0,
    }} />
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div style={{
        padding: "12px 14px",
        borderBottom: "1px solid var(--border)",
        transition: "background 0.1s",
      }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--surf2)")}
        onMouseLeave={e => (e.currentTarget.style.background = "")}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
          <ScoreDot score={item.score} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              title={item.title_orig}
              style={{
                fontWeight: 700, fontSize: "0.88rem", lineHeight: 1.45,
                color: "var(--fg)", marginBottom: "4px",
                overflow: "hidden", display: "-webkit-box",
                WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              }}
            >
              {item.title}
            </div>
            {item.desc && (
              <div style={{
                fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.5,
                overflow: "hidden", display: "-webkit-box",
                WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                marginBottom: "5px",
              }}>
                {item.desc}
              </div>
            )}
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <span style={{
                fontSize: "0.68rem", fontWeight: 700,
                color: item.region === "KR" ? "#436B95" : "#8B5E3C",
                background: item.region === "KR" ? "var(--blue-pale)" : "#F5ECD8",
                padding: "1px 6px",
              }}>
                {item.region === "KR" ? "국내" : "글로벌"}
              </span>
              <span style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 600 }}>
                {item.source}
              </span>
              <span style={{ fontSize: "0.68rem", color: "var(--muted)", marginLeft: "auto" }}>
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

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
        <h1 style={{ fontFamily: "var(--maru)", color: "var(--blue-deep)", margin: 0 }}>
          오늘의 증시 뉴스
        </h1>
        {cachedAt && (
          <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
            {timeAgo(cachedAt)} 갱신
          </span>
        )}
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          style={{
            marginLeft: "auto", padding: "4px 12px",
            background: "transparent", border: "1px solid var(--border)",
            color: "var(--muted)", fontSize: "0.75rem", cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {refreshing ? "새로고침 중..." : "새로고침"}
        </button>
      </div>

      {/* 필터 탭 */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "12px" }}>
        {(["ALL", "KR", "GLOBAL"] as const).map(r => (
          <button
            key={r}
            onClick={() => setRegion(r)}
            style={{
              padding: "5px 14px",
              background: region === r ? "var(--blue)" : "transparent",
              color: region === r ? "#fff" : "var(--muted)",
              border: `1px solid ${region === r ? "var(--blue)" : "var(--border)"}`,
              fontWeight: 700, fontSize: "0.78rem", cursor: "pointer",
            }}
          >
            {r === "ALL" ? `전체 (${items.length})` : r === "KR" ? `국내 (${kr.length})` : `글로벌 (${global.length})`}
          </button>
        ))}
      </div>

      {/* 관련도 범례 */}
      <div style={{
        display: "flex", gap: "14px", alignItems: "center",
        padding: "6px 10px", background: "#F5F0E6",
        border: "1px solid var(--border)", marginBottom: "8px",
        fontSize: "0.68rem", color: "var(--muted)",
      }}>
        <span style={{ fontWeight: 700 }}>관련도</span>
        {[
          { color: "#B5453F", label: "높음" },
          { color: "#B0883A", label: "중간" },
          { color: "var(--muted)", label: "보통" },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: color, display: "inline-block" }} />
            {label}
          </span>
        ))}
      </div>

      {/* 뉴스 목록 */}
      <div className="bh-card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
            뉴스를 불러오는 중...
          </div>
        ) : display.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>📰</div>
            증시 관련 뉴스를 찾지 못했습니다.
          </div>
        ) : (
          display.map((item, i) => <NewsCard key={i} item={item} />)
        )}
      </div>
    </div>
  );
}
