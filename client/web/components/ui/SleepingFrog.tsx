import { FROG_COLORS, FROG_PIXELS } from "@/components/ui/FrogMascot";

type Run = { x: number; y: number; w: number; fill?: string };

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

const FROG_RUNS = toRuns(FROG_PIXELS, FROG_COLORS);

const CLOSED_EYES: Run[] = [
  { x: 3, y: 1, w: 2, fill: FROG_COLORS.g },
  { x: 9, y: 1, w: 2, fill: FROG_COLORS.g },
  { x: 3, y: 2, w: 2, fill: FROG_COLORS.d },
  { x: 9, y: 2, w: 2, fill: FROG_COLORS.d },
];

const SNORE_SCALE = 0.75;

const SNORES = [
  {
    runs: toRuns(["XXXX", "..X.", ".X..", "XXXX"]),
    x: 10,
    y: -3.5,
    color: "#2eff97",
    delay: "0s",
  },
  {
    runs: toRuns(["XXXXX", "...X.", "..X..", ".X...", "XXXXX"]),
    x: 12.5,
    y: -8.25,
    color: "#36dfff",
    delay: "0.8s",
  },
  {
    runs: toRuns(["XXXXXX", "....X.", "...X..", "..X...", ".X....", "XXXXXX"]),
    x: 14.5,
    y: -14,
    color: "#ad46ff",
    delay: "1.6s",
  },
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

interface SleepingFrogProps {
  className?: string;
}

export function SleepingFrog({ className }: SleepingFrogProps) {
  return (
    <svg
      viewBox="-5 -14.5 24 29"
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {SNORES.map((z) => (
        <g
          key={z.delay}
          transform={`translate(${z.x} ${z.y}) scale(${SNORE_SCALE})`}
        >
          <g
            className="nf-twinkle"
            fill={z.color}
            style={{ animationDelay: z.delay }}
          >
            <Pixels runs={z.runs} />
          </g>
        </g>
      ))}

      <g className="nf-bob">
        <Pixels runs={FROG_RUNS} />
        <Pixels runs={CLOSED_EYES} />
      </g>
    </svg>
  );
}
