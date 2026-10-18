"use client";

import { useState } from "react";
import {
  FROG_COLORS,
  FROG_RUNS,
  Pixels,
  toRuns,
} from "@/components/ui/FrogMascot";
import { cn } from "@/lib/utils";

// All in the frog's 14×14 grid. The catch happens under the frog: the header
// bar covers its left side, so anything drawn there would be hidden.
const BUG = toRuns(
  ["a....a", ".a..a.", "..ww..", ".rrrr.", "rkrrkr", ".rrrr."],
  { a: "#d6d3d1", w: "#ffffff", r: "#fb2c36", k: "#1c1917" },
);
// The right pupil glances right, at the bug flying in.
const LOOK = toRuns(["wk"], FROG_COLORS);
const EYELIDS = toRuns(["gg....gg", "dd....dd"], FROG_COLORS);

/** Double-click the frog and it catches a bug with its tongue: debugging. */
export function DebugFrog({ className }: { className?: string }) {
  const [catches, setCatches] = useState(0);

  return (
    <svg
      key={catches}
      viewBox="0 0 14 14"
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        "touch-manipulation select-none overflow-visible",
        catches > 0 && "dbg-run",
        className,
      )}
      role="img"
      aria-label="Жабка-маскот"
      onDoubleClick={() => setCatches((n) => n + 1)}
    >
      <g className="dbg-gulp pointer-events-auto cursor-pointer">
        <Pixels runs={FROG_RUNS} />
        <g className="dbg-look" transform="translate(9 2)">
          <Pixels runs={LOOK} />
        </g>
        <g className="dbg-blink" transform="translate(3 1)">
          <Pixels runs={EYELIDS} />
        </g>
      </g>
      <rect
        className="dbg-tongue"
        x={6}
        y={9}
        width={2}
        height={11}
        fill={FROG_COLORS.p}
      />
      <g transform="translate(4 18)">
        <g className="dbg-bug">
          <Pixels runs={BUG} />
        </g>
      </g>
    </svg>
  );
}
