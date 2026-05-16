"use client";

import { useEffect, useState } from "react";
import {
  apiGuruList, apiGuruAnalyze, apiListStocks,
  type GuruInfo, type GuruVerdict, type StockItem,
} from "@/lib/api";
import { useUIStore } from "@/lib/store";

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

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: "16px",
  boxShadow: "rgba(0,0,0,0.03) 0px 4px 24px",
  overflow: "hidden",
};

function RadarBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontSize: "0.74rem", color: "var(--ink-muted)" }}>{label}</span>
        <span style={{ fontSize: "0.74rem", fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink)" }}>
          {value.toFixed(0)}
        </span>
      </div>
      <div style={{
        height: "6px",
        background: "var(--surface-2)",
        borderRadius: "3px",
        overflow: "hidden",
      }}>
        <div style={{
          width: `${value}%`,
          height: "100%",
          background: "linear-gradient(90deg, var(--purple) 0%, var(--purple-dark) 100%)",
          borderRadius: "3px",
          transition: "width 0.6s ease",
        }} />
      </div>
    </div>
  );
}

function ActionPill({ action, color }: { action: string; color: string }) {
  return (
    <span style={{
      display: "inline-block",
      background: color,
      color: "#fff",
      fontFamily: "var(--mono)",
      fontWeight: 700,
      fontSize: "0.78rem",
      padding: "3px 10px",
      borderRadius: "8px",
      letterSpacing: "0.04em",
    }}>
      {action}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span style={{
      display: "inline-block",
      background: "var(--ink)",
      color: "#fff",
      fontFamily: "var(--mono)",
      fontWeight: 700,
      fontSize: "0.74rem",
      padding: "2px 8px",
      borderRadius: "6px",
    }}>
      {score}점
    </span>
  );
}

function VerdictCard({ verdict }: { verdict: GuruVerdict }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const scoreLabels: Record<string, string> = {
    momentum: "모멘텀", stability: "안정성", value: "가치", growth: "성장", moat: "해자",
  };

  const photoUrl = GURU_PHOTOS[verdict.guru] || "";
  const usePhoto = !!photoUrl && !photoFailed;

  return (
    <div style={cardStyle}>
      {usePhoto ? (
        <div style={{
          position: "relative",
          height: 156,
          overflow: "hidden",
          background: "var(--surface-2)",
        }}>
          <img
            src={photoUrl}
            alt=""
            onError={() => setPhotoFailed(true)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center top",
              filter: "saturate(0.95)",
            }}
          />
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(16,17,20,0) 0%, rgba(16,17,20,0.20) 45%, rgba(16,17,20,0.85) 100%)",
          }} />
          <div style={{ position: "absolute", bottom: 14, left: 18, right: 18 }}>
            <div style={{
              fontFamily: "var(--maru)",
              fontSize: "1.1rem",
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-0.3px",
              lineHeight: 1.2,
            }}>
              {verdict.guru_name}
            </div>
            <div style={{
              fontSize: "0.7rem",
              color: "rgba(255,255,255,0.72)",
              fontWeight: 500,
              marginTop: 2,
              letterSpacing: "0.04em",
            }}>
              {verdict.guru_eng}
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          padding: "16px 20px",
          background: "linear-gradient(135deg, var(--purple-pale) 0%, var(--surface-2) 100%)",
          borderBottom: "1px solid var(--line)",
        }}>
          <div style={{
            fontFamily: "var(--maru)",
            fontSize: "1.05rem",
            fontWeight: 800,
            color: "var(--purple-deep)",
            letterSpacing: "-0.3px",
          }}>
            {verdict.guru_name}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--ink-muted)", marginTop: 2 }}>
            {verdict.guru_eng}
          </div>
        </div>
      )}

      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 20px",
        background: "var(--surface-2)",
        borderBottom: "1px solid var(--line)",
      }}>
        <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)", fontWeight: 600 }}>
          {verdict.style}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <ScoreBadge score={verdict.score} />
          <ActionPill action={verdict.action} color={verdict.action_color} />
        </div>
      </div>

      <div style={{ padding: "20px" }}>
        <div style={{
          background: "var(--purple-pale)",
          borderLeft: "3px solid var(--purple)",
          padding: "12px 14px",
          marginBottom: "18px",
          fontSize: "0.88rem",
          lineHeight: 1.7,
          color: "var(--ink)",
          borderRadius: "0 8px 8px 0",
        }}>
          “{verdict.comment}”
        </div>

        <div style={{ marginBottom: "14px" }}>
          {Object.entries(verdict.scores).map(([k, v]) => (
            <RadarBar key={k} label={scoreLabels[k] ?? k} value={v} />
          ))}
        </div>

        {verdict.reasons && verdict.reasons.length > 0 && (
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: "14px" }}>
            <div style={{
              fontSize: "0.66rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "var(--ink-muted)",
              marginBottom: "8px",
              textTransform: "uppercase",
            }}>
              분석 근거
            </div>
            <ul style={{ margin: 0, paddingLeft: "16px" }}>
              {verdict.reasons.map((r, i) => (
                <li key={i} style={{
                  fontSize: "0.8rem",
                  color: "var(--ink)",
                  marginBottom: "5px",
                  lineHeight: 1.55,
                }}>
                  {r}
                </li>
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
  const [gurus, setGurus]       = useState<GuruInfo[]>([]);
  const [stocks, setStocks]     = useState<StockItem[]>([]);
  const [code, setCode]         = useState(initialCode ?? "");
  const [query, setQuery]       = useState("");
  const [verdicts, setVerdicts] = useState<GuruVerdict[]>([]);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    apiGuruList().then(setGurus);
    apiListStocks({ market: "전체" }).then(setStocks);
  }, []);

  useEffect(() => {
    if (initialCode) return;
    if (selectedCode) setCode(selectedCode);
  }, [selectedCode, initialCode]);

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
  const showSearch = !initialCode && !selectedCode;

  return (
    <div>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        marginBottom: "20px",
      }}>
        <span style={{ width: "3px", height: "18px", background: "var(--purple)", borderRadius: "2px" }} />
        <div style={{
          fontFamily: "var(--maru)",
          fontSize: "1rem",
          fontWeight: 800,
          color: "var(--ink)",
          letterSpacing: "-0.3px",
        }}>
          투자 대가 조언
        </div>
        <span style={{
          fontSize: "0.7rem",
          color: "var(--ink-soft)",
          fontFamily: "var(--mono)",
          marginLeft: "4px",
          letterSpacing: "0.04em",
        }}>
          AI Curated
        </span>
      </div>

      {showSearch && (
        <div style={{ ...cardStyle, padding: "18px 20px", marginBottom: "20px" }}>
          <div style={{
            fontFamily: "var(--maru)",
            fontWeight: 700,
            fontSize: "0.86rem",
            color: "var(--ink)",
            marginBottom: "10px",
            letterSpacing: "-0.2px",
          }}>
            종목 선택
          </div>
          <div style={{ position: "relative" }}>
            <input
              placeholder="종목명 또는 코드 검색 (예: 삼성전자, 005930)"
              value={query}
              onChange={e => { setQuery(e.target.value); setCode(""); setVerdicts([]); }}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                borderRadius: "10px",
                color: "var(--ink)",
                fontSize: "0.88rem",
                fontFamily: "var(--font)",
                outline: "none",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = "var(--purple)";
                e.currentTarget.style.boxShadow = "0 0 0 3px var(--purple-pale)";
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = "var(--line)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            {filtered.length > 0 && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                right: 0,
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "10px",
                boxShadow: "rgba(0,0,0,0.08) 0px 12px 32px",
                zIndex: 10,
                maxHeight: "260px",
                overflowY: "auto",
              }}>
                {filtered.map(s => (
                  <div
                    key={s.code}
                    onClick={() => { setCode(s.code); setQuery(s.name); }}
                    style={{
                      padding: "10px 14px",
                      cursor: "pointer",
                      fontSize: "0.88rem",
                      borderBottom: "1px solid var(--line-soft)",
                      display: "flex",
                      justifyContent: "space-between",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--purple-pale)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ color: "var(--ink)", fontWeight: 600 }}>{s.name}</span>
                    <span style={{ color: "var(--ink-muted)", fontSize: "0.76rem", fontFamily: "var(--mono)" }}>
                      {s.code} · {s.sector}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectedStock && (
            <div style={{
              marginTop: "10px",
              fontSize: "0.78rem",
              color: "var(--purple-deep)",
              fontWeight: 600,
            }}>
              선택됨 · {selectedStock.name} ({selectedStock.code}) · {selectedStock.sector}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div style={{
          ...cardStyle,
          padding: "40px",
          textAlign: "center",
          color: "var(--ink-muted)",
          fontSize: "0.9rem",
        }}>
          대가들의 분석 중...
        </div>
      )}

      {!code && !loading && (
        <div style={{
          ...cardStyle,
          padding: "40px",
          textAlign: "center",
          color: "var(--ink-muted)",
          fontSize: "0.9rem",
          lineHeight: 1.7,
        }}>
          차트 탭에서 종목을 선택하면<br />
          투자 대가 분석이 자동으로 표시됩니다.
        </div>
      )}

      {verdicts.length > 0 && !loading && (
        <div>
          {selectedStock && (
            <div style={{
              marginBottom: "14px",
              fontSize: "0.82rem",
              color: "var(--ink-muted)",
              fontFamily: "var(--mono)",
            }}>
              {selectedStock.name} · {selectedStock.code} · {selectedStock.sector}
            </div>
          )}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "20px",
          }}>
            {verdicts.map(v => <VerdictCard key={v.guru} verdict={v} />)}
          </div>
        </div>
      )}
    </div>
  );
}
