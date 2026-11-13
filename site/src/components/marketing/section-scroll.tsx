"use client";

import { useEffect } from "react";

const scrollKeys = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " ", "Escape"]);

export function SectionScroll() {
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    function stop() {
      cancelAnimationFrame(frame);
      frame = 0;
    }

    function followLink(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link?.hash || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      if (link.origin !== location.origin || link.pathname !== location.pathname || link.search !== location.search) return;

      const section = document.getElementById(link.hash.slice(1));
      if (!section?.hasAttribute("data-scroll-section")) return;
      const target = section;
      stop();
      if (reducedMotion.matches) return;

      event.preventDefault();
      if (link.hash !== location.hash) history.pushState(null, "", link.hash);

      const start = window.scrollY;
      const offset = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const end = Math.max(0, Math.min(maxScroll, target.getBoundingClientRect().top + start - offset));
      const distance = end - start;
      const duration = Math.min(3000, 950 + Math.abs(distance) * 0.45);
      const started = performance.now();

      function move(now: number) {
        const time = Math.min(1, (now - started) / duration);
        const eased = (1 - Math.cos(Math.PI * time)) / 2;
        window.scrollTo({ top: start + distance * eased, behavior: "instant" });
        if (time < 1 && Math.abs(distance) > 2) {
          frame = requestAnimationFrame(move);
        } else {
          frame = 0;
          target.focus({ preventScroll: true });
        }
      }

      frame = requestAnimationFrame(move);
    }

    function handleKey(event: KeyboardEvent) {
      if (scrollKeys.has(event.key)) stop();
    }

    document.addEventListener("click", followLink, true);
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("keydown", handleKey);
    window.addEventListener("popstate", stop);
    window.addEventListener("resize", stop);
    document.addEventListener("visibilitychange", stop);
    reducedMotion.addEventListener("change", stop);

    return () => {
      stop();
      document.removeEventListener("click", followLink, true);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("popstate", stop);
      window.removeEventListener("resize", stop);
      document.removeEventListener("visibilitychange", stop);
      reducedMotion.removeEventListener("change", stop);
    };
  }, []);

  return null;
}
