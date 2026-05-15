"use client";

import { useState, useEffect } from "react";
import MrStockBuddy from "./Logo/MrStockBuddy";
import { useAuthStore, useUIStore } from "@/lib/store";
import { apiLogin, apiMe, apiRegister } from "@/lib/api";

const MENU_ITEMS = [
  { key: "뉴스",           icon: "📰", label: "뉴스" },
  { key: "종목",           icon: "▦",  label: "종목" },
  { key: "차트",           icon: "▲",  label: "차트" },
  { key: "관심종목",       icon: "★",  label: "관심종목" },
  { key: "포트폴리오",     icon: "◈",  label: "포트폴리오" },
  { key: "로보어드바이저", icon: "🤖", label: "로보어드바이저" },
  { key: "프리미엄",       icon: "✦",  label: "프리미엄" },
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
      <div style={{ padding: "12px 8px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "50%",
            background: "linear-gradient(135deg, #D4A030, #E8B838)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1rem", fontWeight: 700, color: "#3A1208",
          }}>
            {(userDisplay ?? "?")[0].toUpperCase()}
          </div>
          <div>
            <div style={{ color: "#F0EBE0", fontWeight: 600, fontSize: "0.88rem" }}>{userDisplay}</div>
            <div style={{
              fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em",
              color: (plan === "premium" || plan === "admin") ? "#D4A030" : "#7CA090",
              textTransform: "uppercase",
            }}>
              {plan === "admin" ? "⚙ ADMIN" : plan === "premium" ? "★ PREMIUM" : "FREE"}
            </div>
          </div>
          <button
            onClick={clearAuth}
            style={{
              marginLeft: "auto", background: "none", border: "1px solid rgba(255,255,255,0.2)",
              color: "#8AB0A0", fontSize: "0.72rem", padding: "4px 8px",
              borderRadius: "2px", cursor: "pointer",
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
      <div style={{ padding: "8px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", gap: "6px" }}>
        <button
          onClick={() => setMode("login")}
          style={{
            flex: 1, background: "var(--green)", color: "#fff", border: "none",
            padding: "8px", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
          }}
        >
          🔑 로그인
        </button>
        <button
          onClick={() => setMode("register")}
          style={{
            flex: 1, background: "transparent", color: "#8AB8A0",
            border: "1px solid #3A6A52", padding: "8px",
            fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
          }}
        >
          ✦ 회원가입
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
      // 로그인 후 /me로 최신 plan 재조회
      setAuth(res.access_token, res.username, res.display, res.plan);
      const me = await apiMe();
      setAuth(res.access_token, me.username, me.display, me.plan);
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ padding: "8px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
      <div style={{ color: "#D4BE80", fontFamily: "var(--maru)", fontSize: "0.9rem", marginBottom: "8px", fontWeight: 700 }}>
        {mode === "login" ? "로그인" : "회원가입"}
      </div>
      <input
        placeholder="아이디"
        value={username}
        onChange={e => setUsername(e.target.value)}
        style={inputStyle}
      />
      {mode === "register" && (
        <input
          placeholder="닉네임"
          value={display}
          onChange={e => setDisplay(e.target.value)}
          style={inputStyle}
        />
      )}
      <input
        type="password"
        placeholder="비밀번호"
        value={password}
        onChange={e => setPassword(e.target.value)}
        style={inputStyle}
      />
      {error && <div style={{ color: "var(--red)", fontSize: "0.75rem", marginBottom: "6px" }}>{error}</div>}
      <div style={{ display: "flex", gap: "6px" }}>
        <button
          type="submit"
          style={{ flex: 1, background: "var(--green)", color: "#fff", border: "none", padding: "8px", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}
        >
          확인
        </button>
        <button
          type="button"
          onClick={() => setMode("guest")}
          style={{ background: "transparent", color: "#7CA090", border: "1px solid #3A6A52", padding: "8px 12px", cursor: "pointer", fontSize: "0.82rem" }}
        >
          취소
        </button>
      </div>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  background: "rgba(0,0,0,0.3)",
  border: "1px solid #3A6A52",
  color: "#E5DECD",
  padding: "6px 8px",
  fontSize: "0.82rem",
  marginBottom: "6px",
  outline: "none",
};

export default function Sidebar() {
  const { menu, setMenu } = useUIStore();

  return (
    <aside style={{
      width: "220px",
      minWidth: "220px",
      background: "var(--green-deep)",
      borderRight: "1px solid #1A3028",
      display: "flex",
      flexDirection: "column",
      height: "100%",
      alignSelf: "stretch",
      position: "sticky",
      top: 0,
      overflowY: "auto",
      flexShrink: 0,
    }}>
      {/* 로고 */}
      <div style={{ padding: "20px 12px 12px", display: "flex", justifyContent: "center" }}>
        <MrStockBuddy size={160} />
      </div>

      {/* 인증 패널 */}
      <AuthPanel />

      {/* 메뉴 */}
      <nav style={{ padding: "8px 0", flex: 1 }}>
        <div style={{
          fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em",
          color: "var(--green-soft)", padding: "8px 8px 4px", textTransform: "uppercase",
          textAlign: "center",
        }}>
          화면
        </div>
        {MENU_ITEMS.map(item => {
          const active = menu === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setMenu(item.key)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                width: "100%",
                padding: "10px 8px",
                background: active ? "rgba(56,105,72,0.4)" : "transparent",
                color: active ? "#E0D8C8" : "#8AB8A0",
                border: "none",
                borderBottom: active ? "2px solid var(--green-soft)" : "2px solid transparent",
                cursor: "pointer",
                fontFamily: "var(--font)",
                fontSize: "0.88rem",
                fontWeight: active ? 700 : 500,
                textAlign: "center",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: "0.9rem" }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 하단 버전 */}
      <div style={{
        padding: "12px 16px",
        fontSize: "0.7rem",
        color: "var(--green-soft)",
        borderTop: "1px solid #1A3028",
        fontFamily: "var(--maru)",
        textAlign: "center",
      }}>
        PRISM™ Engine v2.0
      </div>
    </aside>
  );
}
