"use client";

import { Fragment, useEffect, useRef } from "react";
import Link from "next/link";

const REPEAT = 12;
const DURATION = REPEAT * 7500;
const SLOW_RATE = 0.2;
const RAMP = 600;

export function Marquee() {
  const trackRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const anim = el.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-50%)" }],
      { duration: DURATION, iterations: Infinity, easing: "linear" },
    );
    animRef.current = anim;
    return () => {
      cancelAnimationFrame(rafRef.current);
      anim.cancel();
    };
  }, []);

  const rampTo = (target: number) => {
    const anim = animRef.current;
    if (!anim) return;
    cancelAnimationFrame(rafRef.current);
    const start = anim.playbackRate;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - t0) / RAMP, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      anim.playbackRate = start + (target - start) * eased;
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const group = (
    <div className="flex shrink-0 items-center gap-8 pr-8" aria-hidden>
      {Array.from({ length: REPEAT }).map((_, i) => (
        <Fragment key={i}>
          <span className="whitespace-nowrap text-xl font-semibold uppercase text-black">
            Приєднатись до команди
          </span>
          <span className="size-6 shrink-0 rounded-full bg-black" />
        </Fragment>
      ))}
    </div>
  );

  return (
    <Link
      href="/join"
      aria-label="Приєднатись до команди"
      onMouseEnter={() => rampTo(SLOW_RATE)}
      onMouseLeave={() => rampTo(1)}
      className="block overflow-hidden bg-gradient-main py-6 transition-opacity hover:opacity-90"
    >
      <div ref={trackRef} className="flex w-max">
        {group}
        {group}
      </div>
    </Link>
  );
}
