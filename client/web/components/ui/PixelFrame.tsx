import type { CSSProperties, ReactNode } from 'react';
import { toRuns } from './FrogMascot';
import { cn } from '@/lib/utils';

/**
 * A box with pixel-rounded corners, two steps like the frogs' own curves. The outer layer is the
 * line, the inner one the fill; both are cut by the same stepped clip-path (`.px-frame`).
 */
export function PixelFrame({
  className,
  innerClassName,
  style,
  children,
}: {
  className?: string;
  innerClassName?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className={cn('px-frame bg-(--px-line) p-[2px]', className)} style={style}>
      <div className={cn('px-frame h-full w-full bg-(--px-fill)', innerClassName)}>{children}</div>
    </div>
  );
}

const TAIL_COLORS = { b: 'var(--px-line)', f: 'var(--px-fill)' };
/** Points left, at the frog beside the bubble; its right column covers the bubble's line. */
const TAIL_LEFT = toRuns(['...bf', '..bff', '.bfff', 'bffff', '.bfff', '..bff', '...bf'], TAIL_COLORS);
/** Points up, at the frog above the bubble on narrow screens. */
const TAIL_UP = toRuns(['...b...', '..bfb..', '.bfffb.', 'bfffffb', 'fffffff'], TAIL_COLORS);

function Tail({ runs, viewBox, className, style }: { runs: ReturnType<typeof toRuns>; viewBox: string; className?: string; style?: CSSProperties }) {
  return (
    <svg
      viewBox={viewBox}
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={cn('pointer-events-none absolute', className)}
      style={style}
    >
      {runs.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}

/**
 * What the page's frog says. `eye` is the frog's eye line in frog pixels up from the scene's
 * bottom edge (the row is bottom-aligned), so the side tail points at its eyes whatever the scene.
 */
export function SpeechBubble({
  eye,
  className,
  children,
}: {
  eye: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('relative', className)}>
      <PixelFrame innerClassName="px-5 py-4 sm:px-6 sm:py-5">
        <p className="text-balance text-center text-base leading-relaxed text-muted sm:text-left sm:text-lg">
          {children}
        </p>
      </PixelFrame>
      <Tail runs={TAIL_UP} viewBox="0 0 7 5" className="-top-[12px] left-1/2 h-[15px] w-[21px] -translate-x-1/2 sm:hidden" />
      <Tail
        runs={TAIL_LEFT}
        viewBox="0 0 5 7"
        className="-left-[12px] hidden h-[21px] w-[15px] sm:block"
        // At the frog's eyes, but a few steps under the bubble's top corner, or its top edge runs
        // on from the corner's curve: a tall scene (the merch frog in its long tee) has its eyes
        // higher than a short bubble reaches.
        style={{ bottom: `min(calc(var(--fpx) * ${eye} - 10px), calc(100% - 36px))` }}
      />
    </div>
  );
}
