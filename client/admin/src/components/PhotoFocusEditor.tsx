'use client';

import { useRef } from 'react';
import { mediaUrl } from '@/lib/api';

export interface PhotoFocusValue {
  x: number;
  y: number;
  zoom: number;
}

export const DEFAULT_PHOTO_FOCUS: PhotoFocusValue = { x: 50, y: 50, zoom: 100 };

export interface PhotoFrame {
  label: string;
  aspect: string;
  width?: number;
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

export function focusedImageStyle(focus: PhotoFocusValue): React.CSSProperties {
  const origin = `${focus.x}% ${focus.y}%`;
  return {
    objectPosition: origin,
    transformOrigin: origin,
    transform: focus.zoom !== 100 ? `scale(${focus.zoom / 100})` : undefined,
  };
}

export function PhotoFocusEditor({
  src,
  value,
  onChange,
  frames,
}: {
  src: string;
  value: PhotoFocusValue;
  onChange: (value: PhotoFocusValue) => void;
  frames: PhotoFrame[];
}) {
  const url = mediaUrl(src);
  const dragging = useRef(false);

  const pick = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.round(clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100));
    const y = Math.round(clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100));
    if (x !== value.x || y !== value.y) onChange({ ...value, x, y });
  };

  if (!url) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-bg-soft p-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-muted">Видима частина фото</span>
        <span className="text-xs text-subtle">
          Натисни або потягни по фото, щоб обрати точку, яка має бути в рамці.
          Масштаб — повзунком нижче. Сам файл не змінюється.
        </span>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div
          className="relative inline-block max-w-full cursor-crosshair touch-none select-none overflow-hidden rounded-lg"
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            pick(e);
          }}
          onPointerMove={(e) => {
            if (dragging.current) pick(e);
          }}
          onPointerUp={() => {
            dragging.current = false;
          }}
          onPointerCancel={() => {
            dragging.current = false;
          }}
        >
          <img
            src={url}
            alt=""
            draggable={false}
            className="block max-h-64 w-auto max-w-full"
          />
          <span
            className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.6)]"
            style={{ left: `${value.x}%`, top: `${value.y}%` }}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          {frames.map((frame) => (
            <div key={frame.label} className="flex flex-col gap-1">
              <div
                className="relative overflow-hidden rounded-lg border border-border bg-surface"
                style={{ aspectRatio: frame.aspect, width: frame.width ?? 120 }}
              >
                <img
                  src={url}
                  alt=""
                  draggable={false}
                  className="absolute inset-0 h-full w-full object-cover"
                  style={focusedImageStyle(value)}
                />
              </div>
              <span className="max-w-[10rem] text-xs text-subtle">{frame.label}</span>
            </div>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-3 text-sm text-muted">
        <span className="shrink-0">Масштаб</span>
        <input
          type="range"
          min={100}
          max={300}
          step={5}
          value={value.zoom}
          onChange={(e) => onChange({ ...value, zoom: Number(e.target.value) })}
          className="w-full accent-brand-cyan"
        />
        <span className="w-12 shrink-0 text-right tabular-nums">
          ×{(value.zoom / 100).toFixed(2).replace(/\.?0+$/, '')}
        </span>
      </label>

      <button
        type="button"
        onClick={() => onChange(DEFAULT_PHOTO_FOCUS)}
        className="self-start rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:text-fg"
      >
        Скинути
      </button>
    </div>
  );
}
