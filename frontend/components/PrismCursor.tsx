"use client";
import { useEffect } from "react";

export default function PrismCursor() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(hover: none), (pointer: coarse)").matches) return;

    const dot = document.createElement("div");
    const ring = document.createElement("div");
    dot.id = "prism-cursor-dot";
    ring.id = "prism-cursor-ring";
    document.body.appendChild(dot);
    document.body.appendChild(ring);

    let mx = -100, my = -100;
    let rx = -100, ry = -100;
    let hovering = false;
    let pressing = false;
    let onChart = false;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      const el = e.target as Element | null;
      onChart = !!el?.closest?.(".js-plotly-plot, canvas");
      const interactive = !!el?.closest?.(
        "a, button, [role='button'], input, select, textarea, summary, label, .bh-card[onclick]"
      );
      if (interactive !== hovering) {
        hovering = interactive;
        document.body.classList.toggle("prism-cursor-hover", hovering);
      }
      document.body.classList.toggle("prism-cursor-onchart", onChart);
    };
    const onDown = () => { pressing = true; document.body.classList.add("prism-cursor-press"); };
    const onUp   = () => { pressing = false; document.body.classList.remove("prism-cursor-press"); };
    const onLeave = () => {
      dot.style.opacity = "0";
      ring.style.opacity = "0";
    };
    const onEnter = () => {
      dot.style.opacity = "1";
      ring.style.opacity = "1";
    };

    const tick = () => {
      // 링은 lerp로 부드럽게 따라옴 (트레일 효과)
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%, -50%)`;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mousedown", onDown, { passive: true });
    window.addEventListener("mouseup", onUp, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseenter", onEnter);
    raf = requestAnimationFrame(tick);

    document.body.classList.add("prism-cursor-active");

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseenter", onEnter);
      dot.remove();
      ring.remove();
      document.body.classList.remove(
        "prism-cursor-active",
        "prism-cursor-hover",
        "prism-cursor-press",
        "prism-cursor-onchart"
      );
    };
  }, []);

  return null;
}
