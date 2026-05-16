"use client";

import { useEffect, useRef, useState } from "react";
import { apiSearchStocks, type StockSearchHit } from "@/lib/api";
import { useUIStore } from "@/lib/store";

/**
 * 헤더 중앙 검색바 — 종목명·코드·업종 부분일치 자동완성.
 * 입력 200ms 디바운스 후 /stocks/search 호출, 결과 클릭 시 차트 페이지로 점프.
 */
export default function SearchBar({
  placeholder = "종목명·코드·업종 검색  예) 카카오, 005930",
}: {
  placeholder?: string;
}) {
  const setChart = useUIStore((s) => s.setChart);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<StockSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    const kw = q.trim();
    if (!kw) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const items = await apiSearchStocks(kw, 10);
        if (ctrl.signal.aborted) return;
        setHits(items);
        setActive(0);
      } catch {
        if (!ctrl.signal.aborted) setHits([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [q]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (hit: StockSearchHit) => {
    setChart(hit.code);
    setQ("");
    setHits([]);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(hits[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showDropdown = open && q.trim().length > 0;

  return (
    <form
      ref={wrapRef}
      className="psl-search"
      onSubmit={(e) => {
        e.preventDefault();
        if (hits.length > 0) pick(hits[active]);
      }}
      role="search"
    >
      <span className="psl-search-icon" aria-hidden />
      <input
        type="search"
        className="psl-search-input"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label="종목 검색"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
      />

      {showDropdown && (
        <div className="psl-search-dropdown" role="listbox">
          {loading && hits.length === 0 ? (
            <div className="psl-search-empty">검색 중…</div>
          ) : hits.length === 0 ? (
            <div className="psl-search-empty">검색 결과가 없습니다.</div>
          ) : (
            hits.map((h, i) => (
              <button
                type="button"
                key={h.code}
                role="option"
                aria-selected={i === active}
                className={`psl-search-item${i === active ? " is-active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(h);
                }}
              >
                <span className={`psl-search-mkt psl-search-mkt--${h.market === "코스닥" ? "kosdaq" : "kospi"}`}>
                  {h.market}
                </span>
                <span className="psl-search-name">{h.name}</span>
                <span className="psl-search-code">{h.code}</span>
                <span className="psl-search-sector">{h.sector}</span>
              </button>
            ))
          )}
        </div>
      )}
    </form>
  );
}
