"use client";

import { useState } from "react";
import Link from "next/link";
import MrStockBuddy from "@/components/Logo/MrStockBuddy";
import SearchBar from "./SearchBar";
import HeaderClock from "./HeaderClock";
import AuthArea from "./AuthArea";
import MobileDrawer from "./MobileDrawer";
import { useHourlyChime } from "@/lib/useHourlyChime";

/** 사이트 헤더 — 좌:로고 / 중:검색 / 우:시계+인증 + 모바일 햄버거 */
export default function AppHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  useHourlyChime();

  return (
    <>
      <header className="psl-header">
        <button
          type="button"
          className="psl-hamburger"
          aria-label="메뉴 열기"
          onClick={() => setDrawerOpen(true)}
        >
          <span /><span /><span />
        </button>

        <div className="psl-header-logo">
          <Link href="/" style={{ textDecoration: "none" }}>
            <MrStockBuddy size={44} />
          </Link>
        </div>

        <div className="psl-header-mid">
          <SearchBar />
        </div>

        <div className="psl-header-right">
          <HeaderClock />
          <AuthArea />
        </div>
      </header>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
