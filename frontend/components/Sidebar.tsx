"use client";

import { useState, useEffect } from "react";
import MrStockBuddy from "./Logo/MrStockBuddy";
import { useAuthStore, useUIStore } from "@/lib/store";
import { apiLogin, apiMe, apiRegister } from "@/lib/api";

const MENU_ITEMS = [
  { key: "뉴스",           label: "뉴스" },
  { key: "종목",           label: "종목" },
  { key: "차트",           label: "차트" },
  { key: "관심종목",       label: "관심종목" },
  { key: "포트폴리오",     label: "포트폴리오" },
  { key: "로보어드바이저", label: "로보어드바이저" },
  { key: "프리미엄",       label: "프리미엄" },
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
      <div style={{ padding: "16px 18px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "34px", height: "34px", borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(212,160,48,0.95), rgba(232,184,56,0.95))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.95rem", fontWeight: 700, color: "#3A1208",
            boxShadow: "0 0 0 1px rgba(212,160,48,0.40), 0 0 14px rgba(212,160,48,0.22)",
            flexShrink: 0,
          }}>
            {(userDisplay ?? "?")[0].toUpperCase()}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              color: "#F0EBE0",
              fontWeight: 600,
              fontSize: "0.86rem",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {userDisplay}
            </div>
            <div style={{
              fontSize: "0.64rem",
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: (plan === "premium" || plan === "admin") ? "#D4A030" : "rgba(171,225,183,0.70)",
              textTransform: "uppercase",
              marginTop: "2px",
            }}>
              {plan === "admin" ? "ADMIN" : plan === "premium" ? "PREMIUM" : "FREE"}
            </div>
          </div>
          <button
            onClick={clearAuth}
            style={{
              background: "transparent",
              border: "1px solid rgba(171,225,183,0.22)",
              color: "rgba(171,225,183,0.78)",
              fontSize: "0.7rem",
              padding: "4px 8px",
              borderRadius: "3px",
              cursor: "pointer",
              letterSpacing: "0.02em",
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
      <div style={{ padding: "14px 18px", display: "flex", gap: "10px" }}>
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
    <form onSubmit={handleSubmit} style={{ padding: "12px 14px" }}>
      <div style={{
        color: "rgba(240,235,224,0.92)",
        fontFamily: "var(--maru)",
        fontSize: "0.88rem",
        marginBottom: "10px",
        fontWeight: 700,
        letterSpacing: "0.04em",
      }}>
        {mode === "login" ? "로그인" : "회원가입"}
      </div>
      <input placeholder="아이디" value={username} onChange={e => setUsername(e.target.value)} style={inputStyle} />
      {mode === "register" && (
        <input placeholder="닉네임" value={display} onChange={e => setDisplay(e.target.value)} style={inputStyle} />
      )}
      <input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
      {error && <div style={{ color: "#E97A74", fontSize: "0.74rem", marginBottom: "6px" }}>{error}</div>}
      <div style={{ display: "flex", gap: "8px" }}>
        <button type="submit" className="prism-auth-btn-primary">확인</button>
        <button type="button" onClick={() => setMode("guest")} className="prism-auth-btn-ghost" style={{ flex: "0 0 auto", padding: "9px 14px" }}>
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
  border: "1px solid rgba(171,225,183,0.20)",
  color: "#E5DECD",
  padding: "8px 10px",
  fontSize: "0.82rem",
  marginBottom: "6px",
  outline: "none",
  borderRadius: "3px",
};

const SIDEBAR_BG = `
  radial-gradient(140% 60% at 0% 0%, rgba(67,107,149,0.12) 0%, transparent 55%),
  radial-gradient(90% 50% at 100% 100%, rgba(181,69,63,0.07) 0%, transparent 60%),
  linear-gradient(180deg, #244e38 0%, #1c3f2d 100%)
`;

export default function Sidebar() {
  const { menu, setMenu } = useUIStore();

  return (
    <aside
      className="prism-sidebar"
      style={{
        width: "256px",
        minWidth: "256px",
        height: "100%",
        alignSelf: "stretch",
        position: "sticky",
        top: 0,
        overflowY: "auto",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: SIDEBAR_BG,
        borderRight: "1px solid rgba(171,225,183,0.10)",
      }}
    >
      {/* 로고 */}
      <div style={{ padding: "22px 12px 10px", display: "flex", justifyContent: "center" }}>
        <MrStockBuddy size={148} />
      </div>

      <div className="prism-divider" />

      {/* 인증 패널 */}
      <AuthPanel />

      <div className="prism-divider" />

      {/* 메뉴 */}
      <nav style={{ padding: "10px 0 14px", flex: 1 }}>
        <div className="prism-section-label">화면</div>
        {MENU_ITEMS.map(item => {
          const active = menu === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setMenu(item.key)}
              className={`prism-menu-item${active ? " is-active" : ""}`}
              style={{
                display: "block",
                width: "100%",
                padding: "13px 20px",
                background: "transparent",
                color: active ? "#F6FBF1" : "rgba(220,232,222,0.78)",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font)",
                fontSize: "1.02rem",
                fontWeight: active ? 800 : 700,
                letterSpacing: "0.02em",
                textAlign: "center",
                position: "relative",
              }}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="prism-divider" />

      {/* 하단 버전 */}
      <div style={{
        padding: "12px 16px 14px",
        fontSize: "0.68rem",
        color: "rgba(171,225,183,0.62)",
        fontFamily: "var(--maru)",
        letterSpacing: "0.06em",
        textAlign: "center",
      }}>
        <span className="prism-footer-dot" />
        PRISM Momentum · v2.0
      </div>
    </aside>
  );
}
