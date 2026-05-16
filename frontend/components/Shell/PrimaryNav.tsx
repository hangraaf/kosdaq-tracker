"use client";

import { useUIStore } from "@/lib/store";

export const MENU_ITEMS = [
  "뉴스",
  "종목",
  "차트",
  "관심종목",
  "포트폴리오",
  "로보어드바이저",
  "프리미엄",
] as const;

export type MenuKey = (typeof MENU_ITEMS)[number];

/** 헤더 아래 가로 내비 — 7개 메뉴, 활성 시 하단 2px 퍼플 언더라인 */
export default function PrimaryNav() {
  const { menu, setMenu } = useUIStore();

  return (
    <nav className="psl-nav" aria-label="메인 메뉴">
      {MENU_ITEMS.map((item) => {
        const active = menu === item;
        return (
          <button
            key={item}
            type="button"
            onClick={() => setMenu(item)}
            className={`psl-nav-item${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {item}
          </button>
        );
      })}
    </nav>
  );
}
