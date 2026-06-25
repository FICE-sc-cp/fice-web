"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

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
  y?: string;
  delay?: number;
}

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
