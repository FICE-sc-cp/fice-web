"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { UA_VIEWBOX, UA_OBLASTS } from "./ukraineMap.data";

const noopSubscribe = () => () => {};

/** False on the server and the first client render, true once hydrated. */
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

interface UkraineMapProps {
  className?: string;
  /** Oblast fill / outline colors. */
  oblastFill?: string;
  oblastStroke?: string;
  strokeWidth?: number;
  /**
   * SVG aspect handling. Use "none" to stretch the map to fill its container
   * (so absolutely-positioned overlay pins keep their place).
   */
  preserveAspectRatio?: string;
}

/**
 * Flat vector map of Ukraine — just the oblast outlines, no markers, gradients,
 * glow, drop-shadows or background image. Meant to sit behind overlay pins.
 *
 * Rendered client-side only. The path data is very large, and streaming SSR can
 * split such a big inline <svg> across a chunk boundary, which corrupts SVG
 * foreign-content parsing and triggers a hydration mismatch. The map is purely
 * decorative, so skipping SSR is both correct and lighter on the initial HTML.
 */
export function UkraineMap({
  className,
  oblastFill = "rgba(0,227,243,0.05)",
  oblastStroke = "rgba(0,227,243,0.35)",
  strokeWidth = 0.8,
  preserveAspectRatio = "xMidYMid meet",
}: UkraineMapProps) {
  const hydrated = useHydrated();
  if (!hydrated) return null;

  return (
    <svg
      viewBox={UA_VIEWBOX}
      preserveAspectRatio={preserveAspectRatio}
      role="img"
      aria-label="Карта України"
      className={cn("h-full w-full", className)}
    >
      {UA_OBLASTS.map((oblast) => (
        <path
          key={oblast.id}
          d={oblast.path}
          fill={oblastFill}
          stroke={oblastStroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
