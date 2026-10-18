export const FROG_COLORS: Record<string, string> = {
  d: "#2f7a45",
  g: "#57c06e",
  l: "#7ad98c",
  b: "#d8f3d2",
  w: "#ffffff",
  k: "#243b2e",
  p: "#ff9ecf",
};

export const FROG_PIXELS = [
  "...dd....dd...",
  "..dwwd..dwwd..",
  "..dwkd..dkwd..",
  ".dggggggggggd.",
  "dggggggggggggd",
  "dgglgggggglggd",
  "dggggdggdggggd",
  "dgpgdggggdgpgd",
  "dggggddddggggd",
  "dggbbbbbbbbggd",
  "dggbbbbbbbbggd",
  ".dggbbbbbbggd.",
  "..dggggggggd..",
  "...dggddggd...",
];

export type Run = { x: number; y: number; w: number; fill?: string };

/** Pixel rows ("." is empty) as horizontal runs of one colour. */
export function toRuns(rows: string[], colors?: Record<string, string>): Run[] {
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

export function Pixels({ runs }: { runs: Run[] }) {
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

export const FROG_RUNS = toRuns(FROG_PIXELS, FROG_COLORS);

interface FrogMascotProps {
  className?: string;
}

export function FrogMascot({ className }: FrogMascotProps) {
  return (
    <svg
      viewBox="0 0 14 14"
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Жабка-маскот"
    >
      <Pixels runs={FROG_RUNS} />
    </svg>
  );
}
