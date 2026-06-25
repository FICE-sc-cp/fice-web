"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Toggles `inView` once the element scrolls into the viewport.
 * Disconnects after the first reveal so it never re-runs (and never
 * fights the user as they scroll back up). Reduced-motion is handled
 * purely in CSS — the media query forces `.reveal` fully visible — so
 * there's nothing motion-specific to do here.
 */
function useInView() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      // Fire a touch before the element is fully on screen for a livelier feel.
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, inView };
}

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Vertical travel distance, e.g. "2rem". Defaults to 1.25rem (set in CSS). */
  y?: string;
  /** Delay before the reveal starts, in ms. */
  delay?: number;
}

/** Fades + rises a single block into view. */
export function Reveal({ children, className, y, delay }: RevealProps) {
  const { ref, inView } = useInView();

  const style: CSSProperties = {};
  if (y) (style as Record<string, string>)["--reveal-y"] = y;
  if (delay) (style as Record<string, string>)["--reveal-delay"] = `${delay}ms`;

  return (
    <div
      ref={ref}
      style={style}
      className={cn("reveal", inView && "is-visible", className)}
    >
      {children}
    </div>
  );
}

/**
 * Like <Reveal>, but staggers its *direct children* in one after another.
 * Drop your existing grid/flex classes straight onto it — it renders a plain
 * div, so layout is unchanged.
 */
export function RevealGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { ref, inView } = useInView();

  return (
    <div
      ref={ref}
      className={cn("reveal-stagger", inView && "is-visible", className)}
    >
      {children}
    </div>
  );
}
