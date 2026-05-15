"use client";

import { useEffect } from "react";
import { useUIStore } from "@/lib/store";
import StocksPage from "./stocks/StocksPage";
import ChartPage from "./chart/ChartPage";
import PortfolioPage from "./portfolio/PortfolioPage";
import RoboPage from "./robo/RoboPage";
import PremiumPage from "./premium/PremiumPage";
import NewsPage from "./news/NewsPage";

const VALID_MENUS = ["뉴스", "종목", "차트", "관심종목", "포트폴리오", "로보어드바이저", "프리미엄"];

export default function Home() {
  const { menu } = useUIStore();

  useEffect(() => {
    // 초기 진입 시 URL 파라미터로 메뉴 복원
    const params = new URLSearchParams(window.location.search);
    const pageParam = params.get("page");
    if (pageParam && VALID_MENUS.includes(pageParam)) {
      useUIStore.setState({ menu: pageParam });
    }

    // 뒤로가기/앞으로가기 처리 (URL → 상태 동기화)
    const handlePop = () => {
      const p = new URLSearchParams(window.location.search);
      const m = p.get("page") ?? "뉴스";
      useUIStore.setState({ menu: VALID_MENUS.includes(m) ? m : "뉴스" });
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  switch (menu) {
    case "뉴스":           return <NewsPage />;
    case "종목":           return <StocksPage />;
    case "차트":           return <ChartPage />;
    case "관심종목":       return <PortfolioPage favOnly={true} />;
    case "포트폴리오":     return <PortfolioPage favOnly={false} />;
    case "로보어드바이저": return <RoboPage />;
    case "프리미엄":       return <PremiumPage />;
    default:               return <NewsPage />;
  }
}
