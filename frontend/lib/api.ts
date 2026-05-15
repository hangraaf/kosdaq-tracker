export const BASE = process.env.NEXT_PUBLIC_API_URL as string;

if (!BASE) {
  throw new Error("NEXT_PUBLIC_API_URL is not set at build time");
}

if (
  typeof window !== "undefined" &&
  BASE.includes("localhost") &&
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1"
) {
  console.error("[FATAL] Production page is calling localhost API:", BASE);
}

function getToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem("bh-auth");
    if (!raw) return null;
    return JSON.parse(raw)?.state?.token ?? null;
  } catch {
    return null;
  }
}

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    if (res.status === 401) {
      const { useAuthStore } = await import("./store");
      useAuthStore.getState().clearAuth();
      throw new Error("세션이 만료되었습니다. 다시 로그인해 주세요.");
    }
    throw new Error(err.detail ?? "API 오류가 발생했습니다.");
  }
  return res.json();
}

// ── Auth ─────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  username: string;
  display: string;
  plan: string;
}

export async function apiLogin(username: string, password: string): Promise<TokenResponse> {
  const form = new URLSearchParams({ username, password });
  const res = await fetch(`${BASE}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "로그인 실패");
  }
  return res.json();
}

export async function apiRegister(data: {
  username: string; password: string; display?: string; email?: string;
}): Promise<TokenResponse> {
  return req("/auth/register", { method: "POST", body: JSON.stringify(data) });
}

export async function apiMe(): Promise<{ username: string; display: string; plan: string; email: string }> {
  return req("/auth/me");
}

// ── Status ───────────────────────────────────────────────────────────────

export async function apiStatus(): Promise<{ live: boolean; mode: "LIVE" | "DEMO" }> {
  return req("/stocks/status");
}

// ── Stocks ───────────────────────────────────────────────────────────────

export interface StockItem {
  code: string; name: string; market: string; sector: string; base_price: number;
}

export interface StockSnapshot {
  code: string; name: string; market: string; sector: string;
  price: number; change: number; change_rate: number; volume: number; market_cap: number;
}

export interface OHLCVRow {
  date: string; open: number; high: number; low: number; close: number; volume: number;
}

export async function apiListStocks(params?: {
  market?: string; sector?: string; q?: string;
}): Promise<StockItem[]> {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return req(`/stocks/?${qs}`);
}

export async function apiSectors(market = "전체"): Promise<string[]> {
  return req(`/stocks/sectors?market=${encodeURIComponent(market)}`);
}

export async function apiSnapshot(code: string): Promise<StockSnapshot> {
  return req(`/stocks/${code}/snapshot`);
}

export async function apiChart(code: string, period = "1개월"): Promise<{ live: boolean; items: OHLCVRow[] }> {
  return req(`/stocks/${code}/chart?period=${encodeURIComponent(period)}`);
}

export async function apiTodayTopFull(market = "전체", limit = 10): Promise<{ live: boolean; items: StockSnapshot[] }> {
  return req(`/stocks/today/top?market=${encodeURIComponent(market)}&limit=${limit}`);
}

export interface TickerItem {
  code: string; name: string; price: number; change: number; change_rate: number;
}

export async function apiMarketSummary(): Promise<{ live: boolean; items: TickerItem[] }> {
  return req("/market/summary");
}

export interface Indicators {
  dates: string[];
  rsi: number[];
  macd: number[];
  signal: number[];
  hist: number[];
}

export async function apiIndicators(code: string, period = "3개월"): Promise<Indicators> {
  return req(`/stocks/${code}/indicators?period=${encodeURIComponent(period)}`);
}

export async function apiTodayTop(market = "전체", limit = 10): Promise<StockSnapshot[]> {
  return req(`/stocks/today/top?market=${encodeURIComponent(market)}&limit=${limit}`);
}

// ── Portfolio ────────────────────────────────────────────────────────────

export async function apiFavorites(): Promise<StockSnapshot[]> {
  return req("/favorites");
}

export async function apiAddFavorite(code: string) {
  return req(`/favorites/${code}`, { method: "POST" });
}

export async function apiRemoveFavorite(code: string) {
  return req(`/favorites/${code}`, { method: "DELETE" });
}

export interface PortfolioResponse {
  items: Array<{
    code: string; name: string; market: string; sector: string;
    shares: number; avg_price: number; current_price: number;
    current_value: number; pnl: number; pnl_pct: number; change_rate: number;
  }>;
  total_value: number; total_cost: number; total_pnl: number; total_pnl_pct: number;
}

export async function apiPortfolio(): Promise<PortfolioResponse> {
  return req("/portfolio");
}

export async function apiAddPortfolio(data: { code: string; shares: number; avg_price: number }) {
  return req("/portfolio", { method: "POST", body: JSON.stringify(data) });
}

export async function apiRemovePortfolio(code: string) {
  return req(`/portfolio/${code}`, { method: "DELETE" });
}

// ── Payments ─────────────────────────────────────────────────────────────

export interface Plan {
  id: string; name: string; amount: number; period: number;
}

export interface OrderInfo {
  order_id: string; order_name: string; amount: number;
  client_key: string; customer_name: string;
}

export async function apiGetPlans(): Promise<Plan[]> {
  return req("/payments/plans");
}

export async function apiCreateOrder(plan_id: string): Promise<OrderInfo> {
  return req("/payments/order", { method: "POST", body: JSON.stringify({ plan_id }) });
}

export async function apiConfirmPayment(data: {
  payment_key: string; order_id: string; amount: number; plan_id: string;
}): Promise<{ ok: boolean; plan: string; message: string }> {
  return req("/payments/confirm", { method: "POST", body: JSON.stringify(data) });
}

export async function apiCancelSubscription(): Promise<{ ok: boolean; plan: string }> {
  return req("/payments/cancel", { method: "POST" });
}

// ── Guru ─────────────────────────────────────────────────────────────────

export interface GuruInfo {
  key: string; name: string; eng: string; style: string;
  icon: string; color: string; desc: string;
}

export interface GuruVerdict {
  guru: string; guru_name: string; guru_eng: string;
  style: string; icon: string; color: string;
  rating: string; action: string; action_color: string;
  score: number; comment: string;
  scores: { momentum: number; stability: number; value: number; growth: number; moat: number };
  reasons: string[];
  desc: string; stock_name: string; stock_code: string; sector: string;
}

export async function apiGuruList(): Promise<GuruInfo[]> {
  return req("/guru/list");
}

export async function apiGuruAnalyze(code: string, guru: string): Promise<GuruVerdict> {
  return req(`/guru/${code}?guru=${encodeURIComponent(guru)}`);
}

// ── News ─────────────────────────────────────────────────────────────────

export interface NewsItem {
  title: string;
  title_orig?: string;
  link: string;
  desc: string;
  source: string;
  region: "KR" | "GLOBAL";
  published: string;
  score: number;
}

export async function apiNews(params?: { limit?: number; region?: string }): Promise<{ items: NewsItem[]; cached_at: string }> {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return req(`/news/?${qs}`);
}

export async function apiNewsRefresh(): Promise<{ ok: boolean }> {
  return req("/news/refresh", { method: "POST" });
}

// ── Robo ─────────────────────────────────────────────────────────────────

export interface RoboSurveyQuestion {
  id: string; q: string; opts: string[]; w: number[];
}

export interface BacktestPoint {
  date: string;
  value: number;
}

export interface BacktestResult {
  total_return: number;
  series: BacktestPoint[];
  days: number;
  ok: boolean;
  error?: string | null;
}

export interface RoboResult {
  profile_id: number; profile_name: string; profile_eng: string;
  profile_desc: string; tag: string; color: string; bg: string; fg: string;
  items: Array<{
    code: string; name: string; sector: string;
    prism_score: number; weight: number; reason: string;
  }>;
  score_total: number;
  backtest?: BacktestResult | null;
}

export async function apiRoboSurvey(): Promise<RoboSurveyQuestion[]> {
  return req("/robo/survey");
}

export async function apiRoboRecommend(answers: {
  q_goal: number; q_horizon: number; q_loss: number; q_exp: number; q_panic: number;
}): Promise<RoboResult> {
  return req("/robo/recommend", { method: "POST", body: JSON.stringify(answers) });
}
