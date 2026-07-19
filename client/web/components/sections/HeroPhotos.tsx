"use client";

import { useEffect, useRef } from "react";
import { PhotoCard } from "@/components/ui/PhotoCard";

const PHOTOS = [
  { src: "/photo-2.png", className: "left-0 top-12 h-56 w-80 rotate-[7deg]", speed: 0.1 },
  { src: "/photo-4.png", className: "left-6 top-[40%] h-56 w-72 -rotate-[6deg]", speed: 0.05 },
  { src: "/photo-6.png", className: "bottom-8 left-0 h-52 w-72 rotate-[8deg]", speed: 0.14 },
  { src: "/photo-1.png", className: "right-0 top-10 h-56 w-80 -rotate-[8deg]", speed: 0.12 },
  { src: "/photo-3.png", className: "right-0 top-[42%] h-56 w-80 rotate-[4deg]", speed: 0.06 },
  { src: "/photo-5.png", className: "bottom-2 left-[78%] h-52 w-72 -translate-x-1/2 -rotate-[4deg]", speed: 0.16 },
];

// Hero photo collage with a light scroll parallax: each photo drifts up at its
// own speed while the page scrolls.
export function HeroPhotos() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const layers = [...root.querySelectorAll<HTMLElement>("[data-speed]")];
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      for (const el of layers) {
        el.style.transform = `translateY(${-y * Number(el.dataset.speed)}px)`;
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-x-0 bottom-0 top-10 hidden lg:block"
    >
      <div className="relative mx-auto h-full max-w-7xl">
        {PHOTOS.map((p, i) => (
          <div
            key={p.src}
            data-speed={p.speed}
            className={`absolute will-change-transform ${p.className}`}
          >
            <PhotoCard
              src={p.src}
              alt=""
              className="h-full w-full animate-fade"
              style={{ animationDelay: `${250 + i * 120}ms` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
