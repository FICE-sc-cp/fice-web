import { cn } from "@/lib/utils";

interface GlowProps {
  color: string;
  fade?: string;
  shape?: "diamond" | "ellipse";
  blur?: string;
  className?: string;
}

export function Glow({
  color,
  fade = "rgba(0, 0, 0, 0.00)",
  shape = "diamond",
  blur = "40px",
  className,
}: GlowProps) {
  const corner = (direction: string, position: string) =>
    `linear-gradient(to ${direction}, ${color} 0%, ${fade} 50%) ${position} / calc(50% + 1px) calc(50% + 1px) no-repeat`;

  const diamond = [
    corner("bottom right", "bottom right"),
    corner("bottom left", "bottom left"),
    corner("top left", "top left"),
    corner("top right", "top right"),
  ].join(", ");

  const ellipse = `radial-gradient(ellipse farthest-side at center, ${color} 0%, ${fade} 80%)`;

  const isDiamond = shape === "diamond";

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute -z-10", className)}
      style={{
        background: isDiamond ? diamond : ellipse,
        filter: isDiamond && blur !== "0px" ? `blur(${blur})` : undefined,
      }}
    />
  );
}
