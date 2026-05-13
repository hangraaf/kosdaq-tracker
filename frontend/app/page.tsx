"use client";

import { useUIStore } from "@/lib/store";
import StocksPage from "./stocks/StocksPage";
import ChartPage from "./chart/ChartPage";
import PortfolioPage from "./portfolio/PortfolioPage";
import RoboPage from "./robo/RoboPage";
import PremiumPage from "./premium/PremiumPage";
import NewsPage from "./news/NewsPage";

export default function Home() {
  const { menu } = useUIStore();

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
