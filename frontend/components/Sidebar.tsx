"use client";

import { useState, useEffect } from "react";
import MrStockBuddy from "./Logo/MrStockBuddy";
import { useAuthStore, useUIStore } from "@/lib/store";
import { apiLogin, apiMe, apiRegister } from "@/lib/api";

const MENU_ITEMS = [
  { key: "뉴스",           glyph: "◉", label: "뉴스" },
  { key: "종목",           glyph: "▦", label: "종목" },
  { key: "차트",           glyph: "△", label: "차트" },
  { key: "관심종목",       glyph: "✧", label: "관심종목" },
  { key: "포트폴리오",     glyph: "◈", label: "포트폴리오" },
  { key: "로보어드바이저", glyph: "❖", label: "로보어드바이저" },
  { key: "프리미엄",       glyph: "✦", label: "프리미엄" },
];

function AuthPanel() {
  const [mode, setMode] = useState<"guest" | "login" | "register">("guest");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [display, setDisplay] = useState("");
  const [error, setError] = useState("");
  const { token, display: userDisplay, plan, setAuth, clearAuth } = useAuthStore();

  useEffect(() => {
    if (!token) return;
    apiMe().then(me => setAuth(token, me.username, me.display, me.plan)).catch(() => {});
  }, [token]);

  if (token) {
    return (
      <div style={{ padding: "12px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "50%",
            background: "linear-gradient(135deg, #D4A030, #E8B838)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1rem", fontWeight: 700, color: "#3A1208",
            boxShadow: "0 0 0 1px rgba(212,160,48,0.35), 0 0 16px rgba(212,160,48,0.25)",
          }}>
            {(userDisplay ?? "?")[0].toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: "#F0EBE0", fontWeight: 600, fontSize: "0.88rem" }}>{userDisplay}</div>
            <div style={{
              fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.10em",
              color: (plan === "premium" || plan === "admin") ? "#D4A030" : "rgba(171,225,183,0.75)",
              textTransform: "uppercase",
            }}>
              {plan === "admin" ? "⚙ ADMIN" : plan === "premium" ? "★ PREMIUM" : "FREE"}
            </div>
          </div>
          <button
            onClick={clearAuth}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: "1px solid rgba(171,225,183,0.25)",
              color: "rgba(171,225,183,0.85)",
              fontSize: "0.7rem",
              padding: "4px 8px",
              borderRadius: "3px",
              cursor: "pointer",
            }}
          >
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  if (mode === "guest") {
    return (
      <div style={{ padding: "10px", display: "flex", gap: "6px" }}>
        <button onClick={() => setMode("login")} className="prism-auth-btn-primary">
          로그인
        </button>
        <button onClick={() => setMode("register")} className="prism-auth-btn-ghost">
          회원가입
        </button>
      </div>
    );
  }

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError("");
    try {
      let res;
      if (mode === "login") {
        res = await apiLogin(username, password);
      } else {
        res = await apiRegister({ username, password, display });
      }
      setAuth(res.access_token, res.username, res.display, res.plan);
      const me = await apiMe();
      setAuth(res.access_token, me.username, me.display, me.plan);
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ padding: "10px" }}>
      <div style={{
        color: "rgba(212,190,128,0.95)", fontFamily: "var(--maru)",
        fontSize: "0.9rem", marginBottom: "10px", fontWeight: 700,
        letterSpacing: "0.04em",
      }}>
        {mode === "login" ? "로그인" : "회원가입"}
      </div>
      <input placeholder="아이디" value={username} onChange={e => setUsername(e.target.value)} style={inputStyle} />
      {mode === "register" && (
        <input placeholder="닉네임" value={display} onChange={e => setDisplay(e.target.value)} style={inputStyle} />
      )}
      <input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
      {error && <div style={{ color: "var(--red)", fontSize: "0.75rem", marginBottom: "6px" }}>{error}</div>}
      <div style={{ display: "flex", gap: "6px" }}>
        <button type="submit" className="prism-auth-btn-primary">확인</button>
        <button type="button" onClick={() => setMode("guest")} className="prism-auth-btn-ghost" style={{ flex: "0 0 auto", padding: "9px 12px" }}>
          취소
        </button>
      </div>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  background: "rgba(0,0,0,0.28)",
  border: "1px solid rgba(171,225,183,0.22)",
  color: "#E5DECD",
  padding: "7px 9px",
  fontSize: "0.82rem",
  marginBottom: "6px",
  outline: "none",
  borderRadius: "3px",
};

export default function Sidebar() {
  const { menu, setMenu } = useUIStore();

  return (
    <aside className="prism-sidebar">
      {/* 로고 */}
      <div style={{ padding: "20px 12px 8px", display: "flex", justifyContent: "center" }}>
        <MrStockBuddy size={160} />
      </div>

      <div className="prism-divider" />

      {/* 인증 패널 */}
      <AuthPanel />

      <div className="prism-divider" />

      {/* 메뉴 */}
      <nav style={{ padding: "4px 0 10px", flex: 1 }}>
        <div className="prism-section-label">화면</div>
        {MENU_ITEMS.map(item => (
          <button
            key={item.key}
            onClick={() => setMenu(item.key)}
            className={`prism-menu-item${menu === item.key ? " is-active" : ""}`}
          >
            <span className="pm-glyph">{item.glyph}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="prism-divider" />

      {/* 하단 버전 */}
      <div style={{
        padding: "12px 16px",
        fontSize: "0.7rem",
        color: "rgba(171,225,183,0.70)",
        fontFamily: "var(--maru)",
        letterSpacing: "0.04em",
        textAlign: "center",
      }}>
        <span className="prism-footer-dot" />
        PRISM 모멘텀 v2.0
      </div>
    </aside>
  );
}
