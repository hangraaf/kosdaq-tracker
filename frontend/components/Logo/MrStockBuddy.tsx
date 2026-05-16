"use client";

import Image from "next/image";
import logoSrc from "./logo.png";

/**
 * PUPLE STOCK SLIME — 캐릭터 마크 + 워드마크
 * - 캐릭터: PNG를 12px radius 둥근 사각 마스크로 잘라 표시
 * - 워드마크: PUPLE STOCK SLIME (마루부리, 퍼플)
 * - 서브: KOSPI · KOSDAQ
 */
export default function MrStockBuddy({ size = 44 }: { size?: number }) {
  return (
    <div className="psl-logo">
      <div
        className="psl-logo-mark"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <Image
          src={logoSrc}
          alt=""
          width={size}
          height={size}
          priority
        />
      </div>
      <div className="psl-logo-text">
        <span className="psl-logo-name">PUPLE STOCK SLIME</span>
        <span className="psl-logo-sub">KOSPI &middot; KOSDAQ</span>
      </div>
    </div>
  );
}
