const COLORS: Record<string, string> = {
  d: "#2f7a45",
  g: "#57c06e",
  l: "#7ad98c",
  b: "#d8f3d2",
  w: "#ffffff",
  k: "#243b2e",
  p: "#ff9ecf",
};

const PIXELS = [
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

const RECTS: { x: number; y: number; w: number; fill: string }[] = [];
PIXELS.forEach((row, y) => {
  let x = 0;
  while (x < row.length) {
    const ch = row[x];
    if (ch === ".") {
      x += 1;
      continue;
    }
    let w = 1;
    while (x + w < row.length && row[x + w] === ch) w += 1;
    RECTS.push({ x, y, w, fill: COLORS[ch] });
    x += w;
  }
});

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
      {RECTS.map((r) => (
        <rect
          key={`${r.x}-${r.y}`}
          x={r.x}
          y={r.y}
          width={r.w}
          height={1}
          fill={r.fill}
        />
      ))}
    </svg>
  );
}
