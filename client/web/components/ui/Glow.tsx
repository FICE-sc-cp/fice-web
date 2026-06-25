"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Entry = { el: HTMLElement; speed: number };
const entries = new Set<Entry>();
let rafId = 0;
let listening = false;

function tick() {
  rafId = 0;
  const center = window.innerHeight / 2;
  const writes: Array<[HTMLElement, number]> = [];
  entries.forEach(({ el, speed }) => {
    const rect = el.getBoundingClientRect();
    writes.push([el, (center - (rect.top + rect.height / 2)) * speed]);
  });
  for (const [el, y] of writes) {
    el.style.transform = `translateY(${y.toFixed(1)}px)`;
  }
}

function schedule() {
  if (!rafId) rafId = requestAnimationFrame(tick);
}

function register(el: HTMLElement, speed: number) {
  const entry: Entry = { el, speed };
  entries.add(entry);
  if (!listening) {
    listening = true;
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
  }
  schedule();
  return () => {
    entries.delete(entry);
    if (entries.size === 0 && listening) {
      listening = false;
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    }
  };
}

interface GlowProps {
  color: string;
  fade?: string;
  shape?: "diamond" | "ellipse";
  blur?: string;
  className?: string;
  parallax?: number;
}

export function Glow({
  color,
  fade = "rgba(0, 0, 0, 0.00)",
  shape = "diamond",
  blur = "40px",
  className,
  parallax = 0.3,
}: GlowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !parallax) return;
    return register(el, parallax);
  }, [parallax]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const corner = (direction: string, position: string) =>
    `linear-gradient(to ${direction}, ${color} 0%, ${fade} 50%) ${position} / calc(50% + 1px) calc(50% + 1px) no-repeat`;

  const diamond = [
    corner("bottom right", "bottom right"),
    corner("bottom left", "bottom left"),
    corner("top left", "top left"),
    corner("top right", "top right"),
  ].join(", ");

  const ellipse = `radial-gradient(ellipse farthest-side at center, ${color} 0%, ${fade} 80%)`;

  const isDiamond = shape === "diamond";

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute -z-10", className)}
    >
      <div
        ref={ref}
        className={cn(
          "h-full w-full opacity-0 transition-opacity duration-[1600ms] ease-out",
          visible && "opacity-100",
        )}
        style={{
          background: isDiamond ? diamond : ellipse,
          filter: isDiamond && blur !== "0px" ? `blur(${blur})` : undefined,
        }}
      />
    </div>
  );
}
