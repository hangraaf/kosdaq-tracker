"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAuthStore, useAuthModalStore } from "@/lib/store";
import { apiMe } from "@/lib/api";
import { playLogoutChime } from "@/lib/chime";

/** 헤더 우측 인증 영역 — 비로그인: 버튼 2개 (모달 트리거) / 로그인: 아바타 + 로그아웃 */
export default function AuthArea() {
  const { token, display, plan, setAuth, clearAuth } = useAuthStore();
  const { openLogin, openSignup } = useAuthModalStore();

  useEffect(() => {
    if (!token) return;
    apiMe()
      .then((me) => setAuth(token, me.username, me.display, me.plan))
      .catch(() => {});
  }, [token]);

  if (!token) {
    return (
      <div className="psl-auth">
        <button type="button" className="psl-btn-ghost" onClick={openLogin}>
          로그인
        </button>
        <button type="button" className="psl-btn-primary" onClick={openSignup}>
          회원가입
        </button>
      </div>
    );
  }

  const isPaid = plan === "premium" || plan === "admin";
  const initial = (display ?? "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="psl-auth">
      <Link
        href="/profile"
        className={`psl-avatar${isPaid ? " psl-avatar--premium" : ""}`}
        title={display ?? "프로필"}
      >
        {initial}
      </Link>
      <button
        type="button"
        className="psl-logout"
        onClick={() => {
          playLogoutChime();
          clearAuth();
        }}
      >
        로그아웃
      </button>
    </div>
  );
}
