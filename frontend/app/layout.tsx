import type { Metadata } from "next";
import "./globals.css";
import NewsTicker from "@/components/Ticker/NewsTicker";
import Sidebar from "@/components/Sidebar";
import PingOnLoad from "@/components/PingOnLoad";

export const metadata: Metadata = {
  title: "Mr. Stock Buddy — KOSPI · KOSDAQ Tracker",
  description: "PRISM 모멘텀 스코어 기반 한국 주식 트래커",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
        <PingOnLoad />
        {/* 최상단 뉴스 티커 */}
        <NewsTicker />

        {/* 메인 영역 */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <Sidebar />
          <main style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
