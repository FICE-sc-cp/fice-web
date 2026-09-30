const COLORS: Record<string, string> = {
  d: "#7a1f6e",
  p: "#ff6fb8",
  l: "#ffb3da",
  w: "#ffffff",
  m: "#dc5cc8",
  v: "#9a3ddc",
  k: "#b95cf0",
  h: "#e2a4ff",
};

const PIXELS = [
  "..dd........dd..",
  ".dwld......dlwd.",
  "dwlppd....dpplwd",
  "dlppppddddppppld",
  "dlpppmdhhdmpppld",
  "dppppmdkkdmppppd",
  "dpppmmdkkdmmpppd",
  "dppmmmddddmmmppd",
  ".dmmmdvvvvdmmmd.",
  "..dddkvddvkddd..",
  "...dhvd..dvhd...",
  "...dvvd..dvvd...",
  "..dkvd....dvkd..",
  ".dhvd......dvhd.",
  ".dkvd......dvkd.",
  ".ddd........ddd.",
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

interface PixelBowProps {
  className?: string;
}

export function PixelBow({ className }: PixelBowProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Бантик"
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
