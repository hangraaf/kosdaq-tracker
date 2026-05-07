"use client";

import Image from "next/image";
import logoSrc from "./logo.png";

export default function MrStockBuddy({ size = 200 }: { size?: number }) {
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <Image
        src={logoSrc}
        alt="Mr. Stock Buddy"
        width={size}
        height={size}
        style={{ objectFit: "contain" }}
        priority
      />

      {/* ── 하단 텍스트 ── */}
      <div className="text-center leading-tight">
        <div
          style={{
            fontFamily: "var(--maru)",
            fontSize: "1.3rem",
            fontWeight: 700,
            color: "#E8B838",
            textShadow: "1px 2px 0 #3A1208",
            letterSpacing: "0.04em",
          }}
        >
          STOCK TRACKER
        </div>
        <div
          style={{
            fontFamily: "var(--font)",
            fontSize: "0.72rem",
            color: "#D4BE80",
            letterSpacing: "0.15em",
            marginTop: "2px",
          }}
        >
          KOSPI &nbsp;&middot;&nbsp; KOSDAQ
        </div>
      </div>
    </div>
  );
}
