import { cn } from "@/lib/utils";

interface GlowProps {
  color: string;
  fade?: string;
  /** Shape of the glow. "diamond" (default) gives the Figma rhombus blick. */
  shape?: "diamond" | "ellipse";
  /**
   * Soft-blur radius for the diamond (e.g. "40px"). Dissolves the thin seam
   * that the 4-gradient technique can show at fractional pixel sizes and makes
   * the glow look softer. Set to "0px" for a crisp edge.
   */
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
  // Four linear gradients, one per corner, each fading from the color (at the
  // center) to transparent along its diagonal. Together they form a rhombus.
  //
  // The tiles overlap by 1px (`calc(50% + 1px)`) instead of meeting at exactly
  // 50%: that closes the sub-pixel gap that otherwise flashes as a cross down
  // the centre when the page is resized to an odd pixel size.
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
