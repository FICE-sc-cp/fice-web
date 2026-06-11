import { cn } from "@/lib/utils";

interface GlowProps {
  color: string;
  fade?: string;
  className?: string;
}

export function Glow({
  color,
  fade = "rgba(0, 0, 0, 0.00)",
  className,
}: GlowProps) {
  const background = `radial-gradient(ellipse farthest-side at center, ${color} 0%, ${fade} 80%)`;

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute -z-10", className)}
      style={{ background }}
    />
  );
}
