"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token: string | null;
  username: string | null;
  display: string | null;
  plan: string | null;
  setAuth: (token: string, username: string, display: string, plan: string) => void;
  clearAuth: () => void;
  isPremium: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      username: null,
      display: null,
      plan: null,
      setAuth: (token, username, display, plan) => {
        localStorage.setItem("token", token);
        set({ token, username, display, plan });
      },
      clearAuth: () => {
        localStorage.removeItem("token");
        set({ token: null, username: null, display: null, plan: null });
      },
      isPremium: () => {
        const plan = get().plan;
        return plan === "premium" || plan === "admin";
      },
    }),
    { name: "bh-auth" }
  )
);

// ── 인증 모달 (로그인/회원가입 인라인) ─────────────────────────────────
type AuthModalMode = "login" | "signup";
interface AuthModalState {
  open: boolean;
  mode: AuthModalMode;
  openLogin: () => void;
  openSignup: () => void;
  setMode: (mode: AuthModalMode) => void;
  close: () => void;
}
export const useAuthModalStore = create<AuthModalState>()((set) => ({
  open: false,
  mode: "login",
  openLogin: () => set({ open: true, mode: "login" }),
  openSignup: () => set({ open: true, mode: "signup" }),
  setMode: (mode) => set({ mode }),
  close: () => set({ open: false }),
}));

interface UIState {
  menu: string;
  selectedCode: string | null;
  market: string;
  period: string;
  setMenu: (menu: string) => void;
  setSelectedCode: (code: string | null) => void;
  setChart: (code: string) => void;
  setMarket: (market: string) => void;
  setPeriod: (period: string) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  menu: "뉴스",
  selectedCode: null,
  market: "전체",
  period: "1개월",
  setMenu: (menu) => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("page", menu);
      window.history.pushState({}, "", `?${params.toString()}`);
    }
    set({ menu });
  },
  setSelectedCode: (code) => set({ selectedCode: code }),
  setChart: (code) => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("page", "차트");
      window.history.pushState({}, "", `?${params.toString()}`);
    }
    set({ selectedCode: code, menu: "차트" });
  },
  setMarket: (market) => set({ market }),
  setPeriod: (period) => set({ period }),
}));

// ── 클라이언트 스냅샷 캐시 (페이지 이동 시 재사용) ─────────────────────

import type { StockSnapshot } from "./api";

const SNAP_TTL_MS = 30_000; // 30초

interface SnapEntry { data: StockSnapshot; ts: number }
const _snapCache: Map<string, SnapEntry> = new Map();

export function getCachedSnap(code: string): StockSnapshot | null {
  const entry = _snapCache.get(code);
  if (!entry) return null;
  if (Date.now() - entry.ts > SNAP_TTL_MS) return null;
  return entry.data;
}

export function setCachedSnap(code: string, data: StockSnapshot): void {
  _snapCache.set(code, { data, ts: Date.now() });
}
