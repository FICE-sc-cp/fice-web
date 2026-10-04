import { FROG_COLORS, FROG_PIXELS } from "@/components/ui/FrogMascot";

type Run = { x: number; y: number; w: number; fill?: string };

const FOUR = [
  "...XXX.",
  "..XXXX.",
  ".XX.XX.",
  "XX..XX.",
  "XXXXXXX",
  "....XX.",
  "....XX.",
];

const QUESTION = [
  ".XXXXX.",
  "XX...XX",
  "....XXX",
  "..XXX..",
  "..XX...",
  ".......",
  "..XX...",
];

const QUESTION_COLOR = "#f6339a";
const SHADOW_OPACITY = 0.35;
const RIGHT_FOUR_X = 18;

function toRuns(rows: string[], colors?: Record<string, string>): Run[] {
  const runs: Run[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === ".") {
        x += 1;
        continue;
      }
      let w = 1;
      while (x + w < row.length && row[x + w] === ch) w += 1;
      runs.push({ x, y, w, fill: colors?.[ch] });
      x += w;
    }
  });
  return runs;
}

const FOUR_RUNS = toRuns(FOUR);
const FOURS = [
  ...FOUR_RUNS,
  ...FOUR_RUNS.map((r) => ({ ...r, x: r.x + RIGHT_FOUR_X })),
];
const QUESTION_RUNS = toRuns(QUESTION);
const FROG_RUNS = toRuns(FROG_PIXELS, FROG_COLORS);
const FROG_SHAPE = toRuns(FROG_PIXELS.map((row) => row.replace(/[^.]/g, "X")));
const EYELIDS: Run[] = [
  { x: 3, y: 1, w: 2, fill: FROG_COLORS.g },
  { x: 9, y: 1, w: 2, fill: FROG_COLORS.g },
  { x: 3, y: 2, w: 2, fill: FROG_COLORS.d },
  { x: 9, y: 2, w: 2, fill: FROG_COLORS.d },
];

function Pixels({ runs }: { runs: Run[] }) {
  return (
    <>
      {runs.map((r) => (
        <rect
          key={`${r.x}-${r.y}`}
          x={r.x}
          y={r.y}
          width={r.w}
          height={1}
          fill={r.fill}
        />
      ))}
    </>
  );
}

interface Pixel404Props {
  className?: string;
}

export function Pixel404({ className }: Pixel404Props) {
  return (
    <svg
      viewBox="-3 -6 31.5 14"
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient
          id="nf-404-gradient"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="25"
          y2="0"
        >
          <stop offset="0" stopColor="#2eff97" />
          <stop offset="0.5" stopColor="#36dfff" />
          <stop offset="1" stopColor="#ad46ff" />
        </linearGradient>
      </defs>

      <g
        fill="url(#nf-404-gradient)"
        opacity={SHADOW_OPACITY}
        transform="translate(0.5 0.5)"
      >
        <Pixels runs={FOURS} />
      </g>
      <g fill="url(#nf-404-gradient)">
        <Pixels runs={FOURS} />
      </g>

      <g transform="translate(9 0) scale(0.5)">
        <g className="nf-bob">
          <g
            fill={FROG_COLORS.g}
            opacity={SHADOW_OPACITY}
            transform="translate(1 1)"
          >
            <Pixels runs={FROG_SHAPE} />
          </g>
          <Pixels runs={FROG_RUNS} />
          <g className="nf-blink">
            <Pixels runs={EYELIDS} />
          </g>
        </g>
      </g>

      <g transform="translate(14 -4.8) scale(0.5)">
        <g className="nf-wobble" fill={QUESTION_COLOR}>
          <g opacity={SHADOW_OPACITY} transform="translate(1 1)">
            <Pixels runs={QUESTION_RUNS} />
          </g>
          <Pixels runs={QUESTION_RUNS} />
        </g>
      </g>
    </svg>
  );
}
