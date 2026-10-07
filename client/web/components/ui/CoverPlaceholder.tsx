import type { CSSProperties } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const GREEN = "46 255 151";
const CYAN = "54 223 255";
const PURPLE = "173 70 255";

const DIRECTIONS = [
  { angle: 135, green: "0% 0%", cyan: "100% 0%", purple: "100% 100%" },
  { angle: 45, green: "0% 100%", cyan: "0% 0%", purple: "100% 0%" },
  { angle: 315, green: "100% 100%", cyan: "0% 100%", purple: "0% 0%" },
  { angle: 225, green: "100% 0%", cyan: "100% 100%", purple: "0% 100%" },
];

const BACKGROUNDS = DIRECTIONS.map((d) =>
  [
    "radial-gradient(ellipse 90% 60% at 50% -10%, rgb(255 255 255 / 0.16), transparent 70%)",
    `radial-gradient(at ${d.green}, rgb(${GREEN} / 0.6), transparent 55%)`,
    `radial-gradient(at ${d.purple}, rgb(${PURPLE} / 0.65), transparent 60%)`,
    `radial-gradient(at ${d.cyan}, rgb(${CYAN} / 0.4), transparent 50%)`,
    `linear-gradient(${d.angle}deg, rgb(${GREEN} / 0.55), rgb(${CYAN} / 0.5) 50%, rgb(${PURPLE} / 0.6))`,
  ].join(", "),
);

const GRID: CSSProperties = {
  backgroundImage:
    "linear-gradient(rgb(255 255 255 / 0.08) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.08) 1px, transparent 1px)",
  backgroundSize: "1.25rem 1.25rem",
  maskImage: "radial-gradient(ellipse at center, #000 20%, transparent 75%)",
  WebkitMaskImage:
    "radial-gradient(ellipse at center, #000 20%, transparent 75%)",
};

function pick(seed: string) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return BACKGROUNDS[Math.abs(hash) % BACKGROUNDS.length];
}

interface CoverPlaceholderProps {
  seed: string;
  className?: string;
}

export function CoverPlaceholder({ seed, className }: CoverPlaceholderProps) {
  return (
    <div
      aria-hidden
      className={cn("absolute inset-0 bg-surface-2", className)}
      style={{ backgroundImage: pick(seed) }}
    >
      <div className="absolute inset-0" style={GRID} />
      <div className="absolute inset-0 flex items-center justify-center">
        <Image
          src="/logo_white.png"
          alt=""
          width={160}
          height={87}
          className="h-auto w-[30%] opacity-90 mix-blend-overlay"
        />
      </div>
    </div>
  );
}
