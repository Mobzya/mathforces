"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const fallbackTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const completed = window.setTimeout(() => setActive(false), 0);
    window.clearTimeout(fallbackTimer.current);
    return () => window.clearTimeout(completed);
  }, [pathname, searchParams]);

  useEffect(() => {
    const beginNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const target = new URL(link.href, window.location.href);
      if (
        target.origin !== window.location.origin ||
        `${target.pathname}${target.search}` ===
          `${window.location.pathname}${window.location.search}`
      ) {
        return;
      }
      setActive(true);
      window.clearTimeout(fallbackTimer.current);
      fallbackTimer.current = window.setTimeout(() => setActive(false), 12_000);
    };

    document.addEventListener("click", beginNavigation, true);
    return () => {
      document.removeEventListener("click", beginNavigation, true);
      window.clearTimeout(fallbackTimer.current);
    };
  }, []);

  return (
    <div aria-hidden="true" className={`navigation-progress ${active ? "is-active" : ""}`}>
      <span />
    </div>
  );
}
