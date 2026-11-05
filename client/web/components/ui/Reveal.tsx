"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Under a PageHero, what is on screen as the page opens waits for the hero to come in (its frog,
 * bubble and call to action have all started by 650 ms of `frog-in`), so the page fills in from
 * the top. Elsewhere, or once the hero is in, nothing waits.
 */
function heroWait() {
  const hop = document
    .querySelector(".animate-frog-in")
    ?.getAnimations()
    .find((a) => (a as CSSAnimation).animationName === "frog-in");
  return hop?.playState === "running" ? Math.max(0, 650 - Number(hop.currentTime)) : 0;
}

function useInView() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.setProperty("--reveal-wait", `${heroWait()}ms`);
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

/**
 * A grid or list whose children rise one by one as each scrolls into view, so a long grid fills
 * in row by row. Children that come in together (a row, a loaded page, a new filter) go in turn.
 */
export function RevealEach({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        const wait = heroWait();
        entries
          .filter((e) => e.isIntersecting)
          .forEach((e, i) => {
            const item = e.target as HTMLElement;
            item.style.animationDelay = `${wait + Math.min(i, 8) * 60}ms`;
            // An attribute React does not own, so a re-render keeps it.
            item.dataset.in = "";
            io.unobserve(item);
          });
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    const watch = () => {
      for (const item of el.children) {
        if (!("in" in (item as HTMLElement).dataset)) io.observe(item);
      }
    };
    watch();
    // Cards a "show more" or a filter brings in.
    const mo = new MutationObserver(watch);
    mo.observe(el, { childList: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className={cn("reveal-each", className)}>
      {children}
    </div>
  );
}
