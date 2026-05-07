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
  setMarket: (market: string) => void;
  setPeriod: (period: string) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  menu: "종목",
  selectedCode: null,
  market: "전체",
  period: "1개월",
  setMenu: (menu) => set({ menu }),
  setSelectedCode: (code) => set({ selectedCode: code }),
  setMarket: (market) => set({ market }),
  setPeriod: (period) => set({ period }),
}));
