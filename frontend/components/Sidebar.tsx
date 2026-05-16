"use client";

import { useEffect } from "react";
import Link from "next/link";
import MrStockBuddy from "./Logo/MrStockBuddy";
import PrismClock from "./PrismClock";
import { useAuthStore, useUIStore } from "@/lib/store";
import { apiMe } from "@/lib/api";
import { playLogoutChime } from "@/lib/chime";

const MENU_ITEMS = [
  { key: "뉴스",           label: "뉴스" },
  { key: "종목",           label: "종목" },
  { key: "차트",           label: "차트" },
  { key: "관심종목",       label: "관심종목" },
  { key: "포트폴리오",     label: "포트폴리오" },
  { key: "로보어드바이저", label: "로보어드바이저" },
  { key: "프리미엄",       label: "프리미엄" },
];

function AuthPanel() {
  const { token, display: userDisplay, plan, setAuth, clearAuth } = useAuthStore();

  useEffect(() => {
    if (!token) return;
    apiMe().then(me => setAuth(token, me.username, me.display, me.plan)).catch(() => {});
  }, [token]);

  if (token) {
    const isPaid = plan === "premium" || plan === "admin";
    const planLabel = plan === "admin" ? "ADMIN" : plan === "premium" ? "PREMIUM" : "FREE";
    const initial = (userDisplay ?? "?").trim().charAt(0).toUpperCase() || "?";
    return (
      <div className="prism-profile">
        <div className="prism-profile-row">
          <div className={`prism-profile-avatar ${isPaid ? "prism-profile-avatar--premium" : "prism-profile-avatar--free"}`}>
            {initial}
          </div>
          <Link href="/profile" className="prism-profile-meta" style={{ textDecoration: "none" }} title="계정 설정">
            <div className="prism-profile-name">{userDisplay}</div>
            <div className={`prism-profile-plan ${isPaid ? "prism-profile-plan--premium" : "prism-profile-plan--free"}`}>
              {planLabel}
            </div>
          </Link>
        </div>
        <button
          onClick={() => { playLogoutChime(); clearAuth(); }}
          className="prism-profile-logout"
          type="button"
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "18px 18px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", gap: "10px" }}>
        <Link href="/auth/login" className="prism-auth-btn-primary" style={{ textAlign: "center", textDecoration: "none" }}>
          로그인
        </Link>
        <Link href="/auth/signup" className="prism-auth-btn-ghost" style={{ textAlign: "center", textDecoration: "none" }}>
          회원가입
        </Link>
      </div>
    </div>
  );
}

const SIDEBAR_BG = `
  radial-gradient(140% 60% at 0% 0%, rgba(67,107,149,0.12) 0%, transparent 55%),
  radial-gradient(90% 50% at 100% 100%, rgba(181,69,63,0.07) 0%, transparent 60%),
  linear-gradient(180deg, #244e38 0%, #1c3f2d 100%)
`;

export default function Sidebar() {
  const { menu, setMenu } = useUIStore();

  return (
    <aside
      className="prism-sidebar"
      style={{
        width: "256px",
        minWidth: "256px",
        height: "100%",
        alignSelf: "stretch",
        position: "sticky",
        top: 0,
        overflow: "hidden",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: SIDEBAR_BG,
        borderRight: "1px solid rgba(171,225,183,0.10)",
      }}
    >
      {/* 상단 고정 영역 — 로고 + 클럭 */}
      <div
        style={{
          flexShrink: 0,
          padding: "20px 12px 14px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          background:
            "linear-gradient(180deg, rgba(12,26,40,0.18) 0%, rgba(12,26,40,0) 100%)",
          borderBottom: "1px solid rgba(171,225,183,0.10)",
          boxShadow: "0 8px 20px -16px rgba(0,0,0,0.55)",
        }}
      >
        <MrStockBuddy size={132} />
        <PrismClock size={124} />
      </div>

      {/* 하단 스크롤 영역 — 인증 + 메뉴 + 푸터 */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
      {/* 인증 패널 */}
      <AuthPanel />

      <div className="prism-divider" />

      {/* 메뉴 */}
      <nav style={{ padding: "10px 0 14px", flex: 1 }}>
        <div className="prism-section-label">DESK</div>
        {MENU_ITEMS.map(item => {
          const active = menu === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setMenu(item.key)}
              className={`prism-menu-item${active ? " is-active" : ""}`}
              style={{
                display: "block",
                width: "100%",
                padding: "13px 20px",
                background: "transparent",
                color: active ? "#F6FBF1" : "rgba(220,232,222,0.78)",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font)",
                fontSize: "1.02rem",
                fontWeight: active ? 800 : 700,
                letterSpacing: "0.02em",
                textAlign: "center",
                position: "relative",
              }}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="prism-divider" />

      {/* 하단 버전 */}
      <div style={{
        padding: "12px 16px 14px",
        fontSize: "0.68rem",
        color: "rgba(171,225,183,0.62)",
        fontFamily: "var(--maru)",
        letterSpacing: "0.06em",
        textAlign: "center",
      }}>
        <span className="prism-footer-dot" />
        PRISM Momentum · v2.0
      </div>
      </div>
    </aside>
  );
}
