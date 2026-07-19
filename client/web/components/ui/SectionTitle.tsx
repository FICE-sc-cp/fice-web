"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionTitleProps {
  children: ReactNode;
  gradient?: string;
  className?: string;
}

export function SectionTitle({
  children,
  gradient = "bg-gradient-main",
  className,
}: SectionTitleProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [barW, setBarW] = useState<number | null>(null);

  // The underline must hug the TEXT, and a wrapped title's box is wider than
  // its lines — so measure the widest rendered line and size the bar to it.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const widest = Math.max(
        0,
        ...[...range.getClientRects()].map((r) => r.width),
      );
      setBarW(widest || null);
    };
    measure();
    document.fonts?.ready.then(measure).catch(() => {});
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [children]);

  return (
    <div className="flex max-w-full justify-center">
      <div className="inline-flex max-w-full flex-col items-center gap-3">
        <h2
          ref={ref}
          className={cn(
            "max-w-full text-balance text-center text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl",
            className,
          )}
        >
          {children}
        </h2>
        <span
          className={cn("h-1.5 w-full rounded-full", gradient)}
          style={barW ? { width: barW } : undefined}
          aria-hidden
        />
      </div>
    </div>
  );
}
