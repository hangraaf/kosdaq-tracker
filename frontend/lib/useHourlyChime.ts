"use client";

import { useEffect, useRef } from "react";
import { playHourlyChime } from "./chime";

/**
 * 사용자가 페이지에 머무는 동안 매 정각에 고급 시계 차임을 울린다.
 * - 브라우저 autoplay 정책: 사용자가 한 번이라도 상호작용해야 AudioContext가 깨어남.
 *   첫 click/keydown/touchstart 이벤트를 받으면 armed.
 * - 탭이 숨겨진 동안(document.hidden) 정각이 지나면 그 회차는 스킵.
 * - 자정 경계, DST 보정은 setTimeout을 매번 재계산해 자동 흡수.
 */
export function useHourlyChime() {
  const armedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const arm = () => { armedRef.current = true; };
    window.addEventListener("click",      arm, { once: true });
    window.addEventListener("keydown",    arm, { once: true });
    window.addEventListener("touchstart", arm, { once: true, passive: true });

    const scheduleNext = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(now.getHours() + 1, 0, 0, 0);
      const delay = Math.max(250, next.getTime() - now.getTime());
      timerRef.current = window.setTimeout(() => {
        if (armedRef.current && !document.hidden) {
          try { playHourlyChime(); } catch { /* swallow */ }
        }
        scheduleNext();
      }, delay);
    };
    scheduleNext();

    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      window.removeEventListener("click", arm);
      window.removeEventListener("keydown", arm);
      window.removeEventListener("touchstart", arm);
    };
  }, []);
}
