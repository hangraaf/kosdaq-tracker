"use client";

import Image from "next/image";
import logoSrc from "./logo.png";

export default function MrStockBuddy({ size = 200 }: { size?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", userSelect: "none", gap: 0 }}>

      {/* 달걀형 크롭 + 배경 제거 */}
      <div style={{
        width: size,
        height: size,
        clipPath: "ellipse(44% 50% at 50% 52%)",
        overflow: "hidden",
        flexShrink: 0,
      }}>
        <Image
          src={logoSrc}
          alt="Mr. Stock Buddy"
          width={size}
          height={size}
          style={{ objectFit: "cover", mixBlendMode: "multiply", display: "block" }}
          priority
        />
      </div>

      {/* Dieter Rams 스타일 문구 */}
      <div style={{ width: "100%", textAlign: "center", marginTop: "2px" }}>
        {/* 상단 구분선 */}
        <div style={{
          display: "flex", alignItems: "center", gap: "6px",
          marginBottom: "6px", padding: "0 8px",
        }}>
          <div style={{ flex: 1, height: "1px", background: "rgba(212,160,48,0.35)" }} />
          <span style={{ color: "#D4A030", fontSize: "0.55rem", opacity: 0.7 }}>◆</span>
          <div style={{ flex: 1, height: "1px", background: "rgba(212,160,48,0.35)" }} />
        </div>

        {/* 메인 타이틀 */}
        <div style={{
          fontFamily: "var(--maru)",
          fontSize: "0.95rem",
          fontWeight: 800,
          color: "#E8C84A",
          letterSpacing: "0.18em",
          lineHeight: 1,
        }}>
          STOCK
        </div>
        <div style={{
          fontFamily: "var(--maru)",
          fontSize: "0.95rem",
          fontWeight: 800,
          color: "#E8C84A",
          letterSpacing: "0.18em",
          lineHeight: 1.2,
        }}>
          TRACKER
        </div>

        {/* 하단 구분선 */}
        <div style={{
          height: "1px",
          background: "rgba(212,160,48,0.3)",
          margin: "5px 8px",
        }} />

        {/* 서브타이틀 */}
        <div style={{
          fontFamily: "var(--font)",
          fontSize: "0.6rem",
          color: "#8AAAC8",
          letterSpacing: "0.22em",
          fontWeight: 500,
          marginBottom: "2px",
        }}>
          KOSPI &middot; KOSDAQ
        </div>
      </div>

    </div>
  );
}
