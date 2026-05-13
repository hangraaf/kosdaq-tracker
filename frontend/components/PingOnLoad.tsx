"use client";
import { useEffect, useState } from "react";
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function PingOnLoad() {
  const [warming, setWarming] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const checkBackend = async () => {
      try {
        const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          setWarming(false);
          return;
        }
      } catch {
        // 슬립 상태 — 웜업 중 표시
      }

      setWarming(true);
      // 백엔드 깨어날 때까지 5초마다 재시도
      timer = setTimeout(checkBackend, 5000);
    };

    checkBackend();
    return () => clearTimeout(timer);
  }, []);

  if (!warming) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: "16px",
      right: "16px",
      zIndex: 9999,
      background: "#1A2A44",
      border: "1px solid #2D4A7A",
      color: "#A8C4E8",
      padding: "10px 16px",
      fontSize: "0.78rem",
      fontFamily: "var(--mono)",
      borderRadius: "4px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
    }}>
      <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
      서버 웜업 중... 잠시만 기다려주세요 (최대 60초)
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
