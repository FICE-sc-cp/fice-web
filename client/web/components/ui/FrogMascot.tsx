/**
 * The council's frog. One palette for every frog on the site: `d` outlines, `g` skin with an `l`
 * highlight and an `m` shade, `b` belly with a `c` shade, `k` pupils, `p` cheeks.
 */
export const FROG_COLORS: Record<string, string> = {
  d: "#23733f",
  g: "#5ccf72",
  l: "#9cec9f",
  m: "#3ea457",
  b: "#e4f7dc",
  c: "#c3e6b9",
  w: "#ffffff",
  k: "#15291c",
  p: "#ff9ecf",
};

/**
 * 14×14, sitting, lit from the top left. The eyes stay on cells x3–4 / x9–10, rows 1–2 and the
 * mouth on rows 7–8: the header, 404 and sleeping frogs draw their eyelids and glances there.
 */
export const FROG_PIXELS = [
  "...dd....dd...",
  "..dwwd..dwwd..",
  "..dwkd..dkwd..",
  ".dggggggggggd.",
  "dgllgggggggggd",
  "dglggggggggmgd",
  "dggggdggdgggmd",
  "dgpgdggggdgpmd",
  "dggggddddgggmd",
  "dggbbbbbbbbgmd",
  "dgbbbbbbbbbcmd",
  "dmgbbbbbbbcgmd",
  ".dmggggggggmd.",
  "dddd......dddd",
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
