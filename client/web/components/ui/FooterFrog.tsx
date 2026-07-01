"use client";

import { useEffect, useRef } from "react";
import { FrogRunner } from "@/components/ui/FrogRunner";

const CACTUS = [
  "..X..",
  "..X..",
  "X.X.X",
  "X.X.X",
  "XXX.X",
  "..XXX",
  "..X..",
  "..X..",
  "..X..",
];
const CACTUS_FILL = "rgba(255, 255, 255, 0.1)";
const CACTUS_COLS = 5;
const CACTUS_ROWS = 9;

const CACTUS_RECTS: { x: number; y: number; w: number }[] = [];
CACTUS.forEach((row, y) => {
  let x = 0;
  while (x < row.length) {
    if (row[x] === ".") {
      x += 1;
      continue;
    }
    let w = 1;
    while (x + w < row.length && row[x + w] !== ".") w += 1;
    CACTUS_RECTS.push({ x, y, w });
    x += w;
  }
});

function PixelCactus({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${CACTUS_COLS} ${CACTUS_ROWS}`}
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {CACTUS_RECTS.map((r) => (
        <rect
          key={`${r.x}-${r.y}`}
          x={r.x}
          y={r.y}
          width={r.w}
          height={1}
          fill={CACTUS_FILL}
        />
      ))}
    </svg>
  );
}

const POOL = 6;
const IDLE_LAP = 7.5;
const TO_START = 1;
const CACTUS_SPEED = 200;
const SPAWN_MIN = 1.1;
const SPAWN_MAX = 1.9;
const GRAVITY = 1900;
const JUMP_V = 400;

type Mode = "idle" | "toStart" | "play";
type Cactus = { slot: number; x: number };

export function FooterFrog() {
  const containerRef = useRef<HTMLDivElement>(null);
  const frogRef = useRef<HTMLDivElement>(null);
  const cactusEls = useRef<(HTMLDivElement | null)[]>([]);

  const g = useRef({
    mode: "idle" as Mode,
    x: 0,
    dir: 1 as 1 | -1,
    facing: 1 as 1 | -1,
    y: 0,
    vy: 0,
    cacti: [] as Cactus[],
    free: Array.from({ length: POOL }, (_, i) => i),
    spawnIn: 0,
    W: 0,
    fw: 0,
    cw: 0,
    ch: 0,
  });

  useEffect(() => {
    const container = containerRef.current;
    const frog = frogRef.current;
    if (!container || !frog) return;

    const measure = () => {
      const st = g.current;
      const rp =
        parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      st.W = container.clientWidth;
      st.fw = frog.offsetWidth || rp * 2.25;
      st.cw = rp * 1;
      st.ch = rp * 1.75;
    };
    measure();
    window.addEventListener("resize", measure);

    const hide = (slot: number) => {
      const el = cactusEls.current[slot];
      if (el) el.style.display = "none";
    };

    const resetToIdle = () => {
      const st = g.current;
      st.cacti.forEach((c) => hide(c.slot));
      st.cacti = [];
      st.free = Array.from({ length: POOL }, (_, i) => i);
      st.y = 0;
      st.vy = 0;
      st.dir = 1;
      st.facing = 1;
      st.mode = "idle";
    };

    const spawnDelay = () => SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);

    let raf = 0;
    let last = 0;
    let running = false;

    const frame = (t: number) => {
      if (!running) return;
      if (!last) last = t;
      let dt = (t - last) / 1000;
      last = t;
      if (dt > 0.05) dt = 0.05;

      const st = g.current;
      const { W, fw } = st;

      if (st.mode === "idle") {
        st.x += st.dir * (W / IDLE_LAP) * dt;
        if (st.x <= 0) {
          st.x = 0;
          st.dir = 1;
        } else if (st.x >= W - fw) {
          st.x = W - fw;
          st.dir = -1;
        }
        st.facing = st.dir === 1 ? 1 : -1;
      } else if (st.mode === "toStart") {
        st.x -= (W / TO_START) * dt;
        st.facing = -1;
        if (st.x <= 0) {
          st.x = 0;
          st.facing = 1;
          st.spawnIn = 0.7;
          st.mode = "play";
        }
      } else {
        st.x = 0;
        st.facing = 1;

        if (st.y > 0 || st.vy !== 0) {
          st.vy -= GRAVITY * dt;
          st.y += st.vy * dt;
          if (st.y <= 0) {
            st.y = 0;
            st.vy = 0;
          }
        }

        st.spawnIn -= dt;
        if (st.spawnIn <= 0 && st.free.length) {
          const slot = st.free.pop()!;
          st.cacti.push({ slot, x: W });
          st.spawnIn = spawnDelay();
        }

        for (let i = st.cacti.length - 1; i >= 0; i--) {
          const c = st.cacti[i];
          c.x -= CACTUS_SPEED * dt;
          if (c.x < -st.cw) {
            hide(c.slot);
            st.free.push(c.slot);
            st.cacti.splice(i, 1);
          }
        }

        const fl = fw * 0.22;
        const fr = fw * 0.8;
        for (const c of st.cacti) {
          const cl = c.x + st.cw * 0.25;
          const cr = c.x + st.cw * 0.78;
          if (fr > cl && fl < cr && st.y < st.ch * 0.8) {
            resetToIdle();
            break;
          }
        }
      }

      frog.style.left = `${st.x}px`;
      frog.style.transform = `scaleX(${st.facing}) translateY(${-st.y}px)`;
      for (const c of st.cacti) {
        const el = cactusEls.current[c.slot];
        if (el) {
          el.style.display = "block";
          el.style.left = `${c.x}px`;
        }
      }

      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          start();
        } else {
          stop();
          resetToIdle();
        }
      },
      { threshold: 0 },
    );
    io.observe(container);

    const onKey = (e: KeyboardEvent) => {
      if (g.current.mode !== "play") return;
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        if (g.current.y === 0) g.current.vy = JUMP_V;
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      stop();
      io.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const onFrogClick = () => {
    const st = g.current;
    if (st.mode === "idle") {
      st.mode = "toStart";
    } else if (st.mode === "play" && st.y === 0) {
      st.vy = JUMP_V;
    }
  };

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-0"
    >
      <div
        ref={frogRef}
        onClick={onFrogClick}
        className="pointer-events-auto absolute bottom-0 left-0 block h-9 w-9 cursor-pointer drop-shadow-md"
      >
        <FrogRunner className="h-full w-full" />
      </div>
      {Array.from({ length: POOL }).map((_, i) => (
        <div
          key={i}
          ref={(el) => {
            cactusEls.current[i] = el;
          }}
          className="absolute bottom-0 h-7 w-4"
          style={{ display: "none" }}
        >
          <PixelCactus className="h-full w-full" />
        </div>
      ))}
    </div>
  );
}
