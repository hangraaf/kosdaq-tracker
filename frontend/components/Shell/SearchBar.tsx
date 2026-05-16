"use client";

import { useState } from "react";

/**
 * 헤더 중앙 검색바 — 종목/티커 점프
 * 현재 기능: 클라이언트 사이드 검색어 입력 (백엔드 endpoint 연결은 후속)
 * 디자인: 12px radius + 1.5px 퍼플 테두리
 */
export default function SearchBar({
  placeholder = "종목명 또는 코드 검색",
  onSubmit,
}: {
  placeholder?: string;
  onSubmit?: (q: string) => void;
}) {
  const [q, setQ] = useState("");

  return (
    <form
      className="psl-search"
      onSubmit={(e) => {
        e.preventDefault();
        if (onSubmit) onSubmit(q.trim());
      }}
      role="search"
    >
      <span className="psl-search-icon" aria-hidden />
      <input
        type="search"
        className="psl-search-input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label="종목 검색"
      />
    </form>
  );
}
