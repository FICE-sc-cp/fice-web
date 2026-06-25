"use client";

import { useEffect, useRef, useState } from "react";

const fmt = (n: number) => Math.round(n).toLocaleString("uk-UA");

interface CountUpProps {
  value: number;
  suffix?: string;
  /** Animation length in ms. */
  duration?: number;
  className?: string;
}

/**
 * Counts from 0 up to `value` the first time it scrolls into view.
 * Starts at 0 on both server and client (so there's no hydration
 * mismatch) and eases out so the final digits land gently.
 */
export function CountUp({
  value,
  suffix = "",
  duration = 1300,
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let start = 0;

    // No motion: skip the tween and just land on the final value.
    // Deferred via rAF so we don't setState synchronously in the effect.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      raf = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(raf);
    }

    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(value * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          raf = requestAnimationFrame(step);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );

    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {fmt(display)}
      {suffix}
    </span>
  );
}
