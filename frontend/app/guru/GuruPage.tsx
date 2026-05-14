"use client";

import { useEffect, useState } from "react";
import {
  apiGuruList, apiGuruAnalyze, apiListStocks,
  type GuruInfo, type GuruVerdict, type StockItem,
} from "@/lib/api";
import { useUIStore } from "@/lib/store";

// 각 대가 AI 캐리커처 — verdict.guru(짧은 키)로 조회
const GURU_PHOTOS: Record<string, string> = {
  달리오:   "/images/gurus/dalio.jpg",
  버핏:     "/images/gurus/buffett.jpg",
  린치:     "/images/gurus/lynch.jpg",
  그레이엄: "/images/gurus/graham.jpg",
  스미스:   "/images/gurus/smith.jpg",
  오닐:     "/images/gurus/oneil.jpg",
  코테가와: "/images/gurus/bnf.jpg",
  카타야마: "/images/gurus/katayama.jpg",
};

function RadarBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{label}</span>
        <span style={{ fontSize: "0.75rem", fontFamily: "var(--mono)", fontWeight: 700 }}>{value.toFixed(0)}</span>
      </div>
      <div style={{ height: "6px", background: "var(--surf2)", borderRadius: "3px" }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: "3px", transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

function VerdictCard({ verdict }: { verdict: GuruVerdict }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const scoreLabels: Record<string, string> = {
    momentum: "모멘텀", stability: "안정성", value: "가치", growth: "성장", moat: "해자",
  };

  const photoUrl = GURU_PHOTOS[verdict.guru] || "";
  const usePhotoHeader = !!photoUrl && !photoFailed;

  return (
    <div style={{ border: `2px solid ${verdict.color}`, background: "var(--surf)", overflow: "hidden" }}>
      {/* 사진 헤더 */}
      {usePhotoHeader ? (
        <div
          style={{
            position: "relative",
            height: 140,
            overflow: "hidden",
            background: "#0A1628",
          }}
        >
          <img
            src={photoUrl}
            alt=""
            onError={() => setPhotoFailed(true)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
          />
          {/* 색상 그라디에이션 오버레이 */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(160deg, ${verdict.color}44 0%, ${verdict.color}AA 60%, #0A162888 100%)`,
          }} />
          {/* 하단 페이드 */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, #0A1628 0%, transparent 55%)",
          }} />
          {/* 텍스트 오버레이 */}
          <div style={{ position: "absolute", bottom: 12, left: 16, right: 12 }}>
            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff", fontFamily: "var(--maru)" }}>
              {verdict.guru_name}
              <span style={{ fontSize: "0.72rem", color: "#B0A898", marginLeft: 8, fontWeight: 500 }}>
                {verdict.guru_eng}
              </span>
            </div>
          </div>
          {/* 등급 뱃지 (우상단) */}
          <div style={{ position: "absolute", top: 12, right: 16, textAlign: "right" }}>
            <div style={{ color: verdict.action_color, fontWeight: 700, fontSize: "0.9rem", marginBottom: 2 }}>
              {verdict.action}
            </div>
            <div style={{ color: "#B0883A", fontSize: "1rem", letterSpacing: "1px" }}>
              {verdict.rating}
            </div>
          </div>
        </div>
      ) : (
        /* Fallback: 이모지 헤더 */
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "16px",
          background: `linear-gradient(135deg, ${verdict.color}11 0%, ${verdict.color}06 100%)`,
          borderBottom: `1px solid ${verdict.color}33`,
        }}>
          <span style={{ fontSize: "2.5rem" }}>{verdict.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--maru)", fontSize: "1rem", fontWeight: 700, color: verdict.color }}>
              {verdict.guru_name} <span style={{ fontSize: "0.78rem", opacity: 0.7 }}>{verdict.guru_eng}</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{verdict.style}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: verdict.action_color, fontWeight: 700, fontSize: "1rem" }}>
              {verdict.action}
            </div>
            <div style={{ color: "#B0883A", fontSize: "1.1rem", letterSpacing: "1px" }}>
              {verdict.rating}
            </div>
          </div>
        </div>
      )}

      {/* 바디 */}
      <div style={{ padding: "20px" }}>
        {/* 스타일 태그 + 종합점수 */}
        {usePhotoHeader && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", fontSize: "0.75rem" }}>
            <span style={{ color: "var(--muted)" }}>{verdict.style}</span>
            <span style={{ fontFamily: "var(--mono)", color: "var(--muted)" }}>종합점수 {verdict.score}</span>
          </div>
        )}

        {/* 코멘트 */}
        <div style={{
          background: `${verdict.color}11`,
          border: `1px solid ${verdict.color}33`,
          padding: "12px 14px",
          marginBottom: "16px",
          fontSize: "0.9rem",
          lineHeight: 1.7,
          fontStyle: "italic",
          color: "var(--fg)",
        }}>
          "{verdict.comment}"
        </div>

        {/* 점수 바 */}
        <div style={{ marginBottom: "14px" }}>
          {Object.entries(verdict.scores).map(([k, v]) => (
            <RadarBar key={k} label={scoreLabels[k] ?? k} value={v} color={verdict.color} />
          ))}
        </div>

        {/* 분석 근거 */}
        {verdict.reasons && verdict.reasons.length > 0 && (
          <div style={{ borderTop: `1px solid ${verdict.color}33`, paddingTop: "12px" }}>
            <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)", marginBottom: "6px", textTransform: "uppercase" }}>
              분석 근거
            </div>
            <ul style={{ margin: 0, paddingLeft: "16px" }}>
              {verdict.reasons.map((r, i) => (
                <li key={i} style={{ fontSize: "0.78rem", color: "var(--fg)", marginBottom: "4px", lineHeight: 1.5 }}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GuruPage({ initialCode }: { initialCode?: string } = {}) {
  const { selectedCode } = useUIStore();
  const [gurus, setGurus]     = useState<GuruInfo[]>([]);
  const [stocks, setStocks]   = useState<StockItem[]>([]);
  const [code, setCode]       = useState(initialCode ?? "");
  const [query, setQuery]     = useState("");
  const [verdicts, setVerdicts] = useState<GuruVerdict[]>([]);
  const [loading, setLoading] = useState(false);

  // 대가 목록 + 종목 목록 로드
  useEffect(() => {
    apiGuruList().then(setGurus);
    apiListStocks({ market: "전체" }).then(setStocks);
  }, []);

  // 차트 페이지에서 선택된 종목 자동 반영
  useEffect(() => {
    if (initialCode) return;
    if (selectedCode) setCode(selectedCode);
  }, [selectedCode, initialCode]);

  // 종목 코드가 바뀌면 전체 대가 자동 분석
  useEffect(() => {
    if (!code || gurus.length === 0) return;
    setLoading(true);
    setVerdicts([]);
    Promise.all(gurus.map(g => apiGuruAnalyze(code, g.key)))
      .then(setVerdicts)
      .finally(() => setLoading(false));
  }, [code, gurus]);

  const filtered = query
    ? stocks.filter(s => s.name.includes(query) || s.code.includes(query)).slice(0, 8)
    : [];

  const selectedStock = stocks.find(s => s.code === code);

  // 차트 페이지에 임베드된 경우(initialCode 또는 selectedCode) 종목 검색 숨김
  const showSearch = !initialCode && !selectedCode;

  return (
    <div>
      <div style={{
        fontFamily: "var(--maru)", fontSize: "0.92rem", fontWeight: 800,
        borderLeft: "5px solid var(--blue-deep)", padding: "2px 0 4px 12px",
        marginBottom: "16px", color: "var(--fg)",
      }}>
        🎩 투자 대가 조언
      </div>

      {/* 종목 검색 — 독립 페이지에서만 표시 */}
      {showSearch && (
        <div className="bh-card" style={{ marginBottom: "16px" }}>
          <div style={{ fontWeight: 700, marginBottom: "10px", color: "var(--fg)" }}>종목 선택</div>
          <div style={{ position: "relative" }}>
            <input
              placeholder="종목명 또는 코드 검색 (예: 삼성전자, 005930)"
              value={query}
              onChange={e => { setQuery(e.target.value); setCode(""); setVerdicts([]); }}
              style={{
                width: "100%", padding: "8px 12px",
                background: "var(--surf2)", border: "1px solid var(--border)",
                color: "var(--fg)", fontSize: "0.88rem", outline: "none",
              }}
            />
            {filtered.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0,
                background: "var(--surf)", border: "1px solid var(--border)",
                zIndex: 10, maxHeight: "240px", overflowY: "auto",
              }}>
                {filtered.map(s => (
                  <div
                    key={s.code}
                    onClick={() => { setCode(s.code); setQuery(s.name); }}
                    style={{
                      padding: "8px 12px", cursor: "pointer", fontSize: "0.88rem",
                      borderBottom: "1px solid var(--border)",
                      display: "flex", justifyContent: "space-between",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--surf2)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}
                  >
                    <span>{s.name}</span>
                    <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{s.code} · {s.sector}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectedStock && (
            <div style={{ marginTop: "8px", fontSize: "0.82rem", color: "var(--blue)" }}>
              선택됨: {selectedStock.name} ({selectedStock.code}) · {selectedStock.sector}
            </div>
          )}
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)", fontSize: "0.88rem" }}>
          대가들의 분석 중...
        </div>
      )}

      {/* 종목 미선택 안내 */}
      {!code && !loading && (
        <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)", fontSize: "0.88rem" }}>
          차트 탭에서 종목을 선택하면 투자 대가 분석이 자동으로 표시됩니다.
        </div>
      )}

      {/* 전체 대가 분석 결과 */}
      {verdicts.length > 0 && !loading && (
        <div>
          {selectedStock && (
            <div style={{ marginBottom: "12px", fontSize: "0.82rem", color: "var(--muted)" }}>
              {selectedStock.name} ({selectedStock.code}) · {selectedStock.sector}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
            {verdicts.map(v => <VerdictCard key={v.guru} verdict={v} />)}
          </div>
        </div>
      )}
    </div>
  );
}
