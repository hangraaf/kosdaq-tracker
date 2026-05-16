"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useUIStore, useAuthStore, useAuthModalStore } from "@/lib/store";
import HeaderClock from "./HeaderClock";
import { MENU_ITEMS } from "./PrimaryNav";

/** 모바일 햄버거 드로어 — 메뉴 7개 + 인증 + 시계 */
export default function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { menu, setMenu } = useUIStore();
  const { token, display, clearAuth } = useAuthStore();
  const { openLogin, openSignup } = useAuthModalStore();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        className={`psl-drawer-backdrop${open ? " is-open" : ""}`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={`psl-drawer${open ? " is-open" : ""}`}
        role="dialog"
        aria-label="메뉴"
        aria-hidden={!open}
      >
        <div className="psl-drawer-header">
          <HeaderClock />
          <button
            type="button"
            className="psl-drawer-close"
            onClick={onClose}
            aria-label="메뉴 닫기"
          >
            ×
          </button>
        </div>

        <nav className="psl-drawer-nav" aria-label="모바일 메인 메뉴">
          {MENU_ITEMS.map((item) => {
            const active = menu === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setMenu(item);
                  onClose();
                }}
                className={`psl-drawer-item${active ? " is-active" : ""}`}
              >
                {item}
              </button>
            );
          })}
        </nav>

        <div className="psl-drawer-foot">
          {token ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Link href="/profile" onClick={onClose} style={{ color: "var(--ink)", textDecoration: "none", fontFamily: "var(--maru)", fontWeight: 700 }}>
                {display ?? "프로필"}
              </Link>
              <button
                type="button"
                className="psl-btn-ghost"
                onClick={() => {
                  clearAuth();
                  onClose();
                }}
              >
                로그아웃
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="psl-btn-ghost"
                onClick={() => { openLogin(); onClose(); }}
                style={{ flex: 1 }}
              >
                로그인
              </button>
              <button
                type="button"
                className="psl-btn-primary"
                onClick={() => { openSignup(); onClose(); }}
                style={{ flex: 1 }}
              >
                회원가입
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
