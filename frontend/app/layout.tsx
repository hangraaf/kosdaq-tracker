import type { Metadata } from "next";
import "./globals.css";
import NewsTicker from "@/components/Ticker/NewsTicker";
import AppHeader from "@/components/Shell/AppHeader";
import PrimaryNav from "@/components/Shell/PrimaryNav";
import Footer from "@/components/Shell/Footer";
import PingOnLoad from "@/components/PingOnLoad";
import PrismCursor from "@/components/PrismCursor";

export const metadata: Metadata = {
  title: "PUPLE STOCK SLIME — KOSPI · KOSDAQ Tracker",
  description: "Kraken Purple 톤 기반 한국 주식 트래커",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ background: "var(--surface)" }}>
        <PingOnLoad />
        <PrismCursor />

        <div className="psl-shell">
          {/* Row 1 — LIVE 증시 티커 */}
          <NewsTicker />

          {/* Row 2 — 헤더 (로고 / 검색 / 시계 + 인증) */}
          <AppHeader />

          {/* Row 3 — 메인 내비 7개 */}
          <PrimaryNav />

          {/* Row 4 — 페이지 컨텐츠 */}
          <main style={{ flex: 1, padding: "24px 28px", width: "100%" }}>
            {children}
          </main>

          {/* Row 5 — 푸터 */}
          <Footer />
        </div>
      </body>
    </html>
  );
}
