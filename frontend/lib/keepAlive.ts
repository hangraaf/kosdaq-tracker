/**
 * Render 무료 플랜 슬립 방지 — 앱 로드 시 백엔드에 ping
 * (15분 비활성 시 슬립, 첫 요청 ~30초 웜업 방지용)
 */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function pingBackend(): void {
  fetch(`${BASE}/health`, { method: "GET" }).catch(() => {});
}
