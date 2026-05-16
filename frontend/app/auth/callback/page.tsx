"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store";

/**
 * OAuth 콜백 처리 페이지.
 * 백엔드가 `/auth/callback#token=...&username=...&display=...&plan=...&return_to=...`
 * 형태로 리다이렉트해주는 것을 파싱해 zustand store에 저장하고 홈으로 보낸다.
 * URL fragment를 쓰는 이유: 서버 로그/Referer/프록시 로그에 토큰이 남지 않게.
 */
export default function OAuthCallbackPage() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const errFromQuery = search.get("error");
    if (errFromQuery) {
      setError(errFromQuery);
      return;
    }

    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const token = params.get("token");
    const username = params.get("username");
    const display = params.get("display");
    const plan = params.get("plan");
    const returnTo = params.get("return_to") || "/";

    if (!token || !username) {
      setError("로그인 응답이 비어 있습니다. 다시 시도해 주세요.");
      return;
    }

    setAuth(token, username, display ?? username, plan ?? "free");

    // URL의 토큰을 즉시 지우고 홈으로 이동
    const dest = returnTo.startsWith("/") ? returnTo : "/";
    window.history.replaceState({}, "", dest);
    window.location.replace(dest);
  }, [setAuth]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "60vh",
      gap: "12px",
      color: "var(--fg)",
    }}>
      {error ? (
        <>
          <div style={{ fontFamily: "var(--maru)", fontSize: "1.1rem", fontWeight: 700 }}>
            로그인 실패
          </div>
          <div style={{ color: "var(--muted)", fontSize: "0.9rem", maxWidth: 480, textAlign: "center" }}>
            {error}
          </div>
          <a
            href="/"
            style={{
              marginTop: "8px",
              padding: "8px 16px",
              background: "var(--green)",
              color: "#fff",
              textDecoration: "none",
              borderRadius: "3px",
              fontWeight: 700,
              fontSize: "0.9rem",
            }}
          >
            처음으로 돌아가기
          </a>
        </>
      ) : (
        <>
          <div style={{ fontFamily: "var(--maru)", fontSize: "1.1rem", fontWeight: 700 }}>
            로그인 처리 중…
          </div>
          <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
            잠시만 기다려 주세요.
          </div>
        </>
      )}
    </div>
  );
}
