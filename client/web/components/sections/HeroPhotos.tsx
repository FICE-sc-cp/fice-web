"use client";

import { useEffect, useRef } from "react";
import { PhotoCard } from "@/components/ui/PhotoCard";

// Below lg the title takes the full width, so four photos sit above and
// below it (peeking in from the edges on phones, bigger and closer to the
// text on tablets); lg+ is the six-photo collage around it.
const PHOTOS = [
  {
    src: "/hero-1.jpg",
    className:
      "-left-5 top-2 h-28 w-40 rotate-[7deg] sm:left-[4%] sm:top-[12%] sm:h-40 sm:w-56 lg:left-0 lg:top-12 lg:h-56 lg:w-80",
    speed: 0.1,
  },
  {
    src: "/hero-2.jpg",
    className: "left-6 top-[40%] hidden h-56 w-72 -rotate-[6deg] lg:block",
    speed: 0.05,
  },
  {
    src: "/hero-3.jpg",
    className:
      "-left-4 bottom-3 h-28 w-40 rotate-[8deg] sm:bottom-[12%] sm:left-[6%] sm:h-40 sm:w-56 lg:bottom-8 lg:left-0 lg:h-52 lg:w-72",
    speed: 0.14,
  },
  {
    src: "/hero-4.jpg",
    className:
      "-right-5 top-10 h-28 w-40 -rotate-[8deg] sm:right-[4%] sm:top-[14%] sm:h-40 sm:w-56 lg:right-0 lg:top-10 lg:h-56 lg:w-80",
    speed: 0.12,
  },
  {
    src: "/hero-5.jpg",
    className: "right-0 top-[42%] hidden h-56 w-80 rotate-[4deg] lg:block",
    speed: 0.06,
  },
  {
    src: "/hero-6.jpg",
    className:
      "bottom-6 left-[86%] h-28 w-40 -translate-x-1/2 -rotate-[4deg] sm:bottom-[10%] sm:left-[80%] sm:h-40 sm:w-56 lg:bottom-2 lg:left-[78%] lg:h-52 lg:w-72",
    speed: 0.16,
  },
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
      className="pointer-events-none absolute inset-x-0 bottom-0 top-10"
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
              sizes="(min-width: 1024px) 20rem, 40vw"
              className="h-full w-full animate-fade"
              style={{ animationDelay: `${250 + i * 120}ms` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
