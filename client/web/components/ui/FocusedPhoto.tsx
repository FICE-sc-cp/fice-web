import { cn } from "@/lib/utils";

export interface PhotoFocus {
  x: number;
  y: number;
  zoom: number;
}

export const DEFAULT_FOCUS: PhotoFocus = { x: 50, y: 50, zoom: 100 };

export function photoFocus(source?: {
  photoFocusX?: number | null;
  photoFocusY?: number | null;
  photoZoom?: number | null;
} | null): PhotoFocus {
  return {
    x: source?.photoFocusX ?? DEFAULT_FOCUS.x,
    y: source?.photoFocusY ?? DEFAULT_FOCUS.y,
    zoom: source?.photoZoom ?? DEFAULT_FOCUS.zoom,
  };
}

export function FocusedPhoto({
  src,
  alt,
  focus = DEFAULT_FOCUS,
  className,
}: {
  src: string;
  alt: string;
  focus?: PhotoFocus;
  className?: string;
}) {
  const origin = `${focus.x}% ${focus.y}%`;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={cn("absolute inset-0 h-full w-full object-cover", className)}
      style={{
        objectPosition: origin,
        transformOrigin: origin,
        transform: focus.zoom !== 100 ? `scale(${focus.zoom / 100})` : undefined,
      }}
    />
  );
}
