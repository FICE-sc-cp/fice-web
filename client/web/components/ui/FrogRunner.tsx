import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = {
  d: "#2f7a45",
  g: "#57c06e",
  l: "#7ad98c",
  b: "#d8f3d2",
  w: "#ffffff",
  k: "#243b2e",
  p: "#ff9ecf",
};

const BODY = [
  "......ddd.....",
  ".....dwwwd....",
  ".....dwwkd....",
  ".dggggggggggd.",
  "dgggggggggggg.",
  "dgllggggggpgd.",
  "dggggggbbbggd.",
  "dgggggbbbbdgd.",
  "dgggggbbbbggd.",
  ".dgggbbbbggd..",
  "..dgggggggd...",
];

const LEGS_A = ["...d...dd.....", "..dd...dd.....", ".......ddd...."];

const LEGS_B = ["...dd...d.....", "...dd...dd....", "..ddd........."];

type Rect = { x: number; y: number; w: number; fill: string };

function toRects(pixels: string[]): Rect[] {
  const rects: Rect[] = [];
  pixels.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === ".") {
        x += 1;
        continue;
      }
      let w = 1;
      while (x + w < row.length && row[x + w] === ch) w += 1;
      rects.push({ x, y, w, fill: COLORS[ch] });
      x += w;
    }
  });
  return rects;
}

const RECTS_A = toRects([...BODY, ...LEGS_A]);
const RECTS_B = toRects([...BODY, ...LEGS_B]);

function Frame({ rects, className }: { rects: Rect[]; className?: string }) {
  return (
    <svg
      viewBox="0 0 14 14"
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {rects.map((r) => (
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

interface FrogRunnerProps {
  className?: string;
}

export function FrogRunner({ className }: FrogRunnerProps) {
  return (
    <div
      className={cn("relative", className)}
      role="img"
      aria-label="Жабка біжить"
    >
      <Frame
        rects={RECTS_A}
        className="frog-step-a absolute inset-0 h-full w-full"
      />
      <Frame
        rects={RECTS_B}
        className="frog-step-b absolute inset-0 h-full w-full"
      />
    </div>
  );
}
