"use client";

import { useEffect, useRef, useState } from "react";
import { shouldReduceMotion } from "@/lib/preferences";

export function AnimatedNumber({ className, value }: { className?: string; value: number }) {
  const [displayed, setDisplayed] = useState(value);
  const current = useRef(value);

  useEffect(() => {
    const from = current.current;
    if (from === value) return;

    const reduceMotion = shouldReduceMotion();
    let frame = 0;
    const startedAt = performance.now();
    const duration = reduceMotion ? 0 : 700;

    const update = (now: number) => {
      const progress = duration === 0 ? 1 : Math.min(1, (now - startedAt) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const next = Math.round(from + (value - from) * eased);
      current.current = next;
      setDisplayed(next);
      if (progress < 1) {
        frame = window.requestAnimationFrame(update);
      }
    };

    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span aria-label={String(value)} className={className}>
      <span aria-hidden="true">{displayed.toLocaleString("ru-RU")}</span>
    </span>
  );
}
