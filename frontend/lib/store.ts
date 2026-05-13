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
  setMenu: (menu) => set({ menu }),
  setSelectedCode: (code) => set({ selectedCode: code }),
  setChart: (code) => set({ selectedCode: code, menu: "차트" }),
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
