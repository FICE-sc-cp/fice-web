'use client';
/* eslint-disable @next/next/no-img-element -- /_next/image does not resize on production, so merch serves its own thumbnails */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CoverPlaceholder } from '@/components/ui/CoverPlaceholder';
import { STATUS_LABEL, parentOf } from '@/lib/merch';
import type { MerchOrderStatus } from '@/lib/merch-types';
import { cn } from '@/lib/utils';
import type { Surface } from './surface';

/** Lives here, not in surface.tsx, so the providers can use this file without an import cycle. */
export const SurfaceContext = createContext<Surface | null>(null);

export function useSurface(): Surface {
  const surface = useContext(SurfaceContext);
  if (!surface) throw new Error('useSurface needs WebSurface or TelegramSurface above it');
  return surface;
}

/** Inputs: 1rem is 14 px on the public tree and iOS zooms into anything under 16 px. */
export const FIELD_CLASS = 'text-[16px]';

/** Every control: a visible keyboard focus, and our press state instead of Android's blue flash. */
export const CONTROL =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan [-webkit-tap-highlight-color:transparent]';

// Touch targets are in px: the public tree's 14 px rem would shrink them under a thumb.
const BUTTON_CLASS = `inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-bold transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 ${CONTROL}`;

/** Goes on `Button` primary. */
export const ACTION_CLASS = 'w-full rounded-2xl py-4 text-lg font-extrabold';
export const SECONDARY_CLASS = `${BUTTON_CLASS} border-border hover:border-brand-cyan hover:text-brand-cyan`;
export const DANGER_CLASS = `${BUTTON_CLASS} border-brand-red/40 text-brand-red hover:bg-brand-red/10`;
export const PANEL_CLASS = 'rounded-3xl border border-border bg-surface p-4';

// ---- Feedback -----------------------------------------------------------------

/**
 * The server's sentence or our own. Without a Ukrainian letter it was not written for a buyer:
 * a lost connection, an unhandled 500, or the throttler's English 429.
 */
export const errorText = (err: unknown, fallback = 'Щось пішло не так. Спробуйте ще раз.') =>
  err instanceof Error && /[а-яєіїґ]/i.test(err.message) ? err.message : fallback;

/** Runs one mutation at a time with an error message and haptics. */
export function useAction() {
  const { tg } = useSurface();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await action();
      tg?.hapticNotify('success');
      return true;
    } catch (err) {
      setError(errorText(err));
      tg?.hapticNotify('error');
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

/** Toast state and its host element for a surface. The host stays mounted, so readers announce it. */
export function useToastHost(kind: Surface['kind']) {
  const [text, setText] = useState('');
  const [shown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toast = useCallback((next: string) => {
    setText(next);
    setShown(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShown(false), 2500);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const toastHost = (
    <div
      role="status"
      className={cn(
        'pointer-events-none fixed left-1/2 z-50 w-max max-w-[min(calc(100vw-2rem),26rem)] -translate-x-1/2 rounded-2xl border border-white/10 bg-black/90 px-4 py-2.5 text-center text-sm font-bold text-fg shadow-2xl shadow-black/60 transition-all duration-200',
        // Clear of the cart bar: over the bottom of a phone, over the tabs in the Mini App.
        kind === 'web'
          ? 'bottom-[calc(88px+env(safe-area-inset-bottom))] sm:bottom-24'
          : 'bottom-[calc(152px+env(safe-area-inset-bottom))]',
        !shown && 'translate-y-2 opacity-0',
      )}
    >
      {text}
    </div>
  );

  return { toast, toastHost };
}

export function Spinner() {
  return (
    <div role="status" aria-label="Завантаження" className="flex justify-center py-16">
      <div className="size-8 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent" />
    </div>
  );
}

export function Banner({ tone, children }: { tone: 'error' | 'hint'; children: ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cn(
        'rounded-xl border p-3 text-[14px] leading-relaxed',
        tone === 'error'
          ? 'border-brand-red/40 bg-brand-red/10 text-brand-red'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-200/90',
      )}
    >
      {children}
    </div>
  );
}

export function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon?: ReactNode;
  title: string;
  text?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
      {icon && (
        <span className="mb-1 flex size-16 items-center justify-center rounded-2xl border border-brand-purple/30 bg-brand-purple/10 text-3xl shadow-[0_0_40px_-12px_var(--color-brand-purple)]">
          {icon}
        </span>
      )}
      <h2 className="text-xl font-extrabold leading-snug">{title}</h2>
      {text && <p className="max-w-sm text-base leading-relaxed text-subtle">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

const STATUS_TONE: Record<MerchOrderStatus, string> = {
  PENDING: 'border-white/15 bg-white/5 text-muted',
  IN_PROCESS: 'border-brand-cyan/40 bg-brand-cyan/15 text-brand-cyan',
  READY_FOR_PICKUP: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
  COMPLETED: 'border-brand-green/40 bg-brand-green/15 text-brand-green',
  CANCELLED: 'border-red-500/40 bg-red-500/15 text-red-400',
};

export function StatusPill({ status }: { status: MerchOrderStatus }) {
  return (
    <span
      className={cn(
        'inline-block shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase',
        STATUS_TONE[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

// ---- Controls -----------------------------------------------------------------

/** `option` also dresses the size buttons of the product page. */
export const CHIP_TONE = {
  filter: {
    on: 'border-transparent bg-gradient-main bg-origin-border font-extrabold text-stone-950',
    off: 'border-border bg-surface/50 font-extrabold text-muted enabled:hover:border-brand-purple/60 enabled:hover:text-fg',
  },
  option: {
    on: 'border-brand-cyan bg-brand-cyan/15 font-semibold text-brand-cyan',
    off: 'border-border bg-surface font-semibold text-muted enabled:hover:border-brand-cyan/50 enabled:hover:text-fg',
  },
};

export function Chip({
  active,
  disabled,
  onClick,
  kind,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick?: () => void;
  kind: 'filter' | 'option';
  children: ReactNode;
}) {
  const { tg } = useSurface();
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={() => {
        tg?.haptic('light');
        onClick?.();
      }}
      className={cn(
        'max-w-full shrink-0 truncate rounded-full border px-4 py-2 text-sm transition-all duration-200 enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-40',
        kind === 'option' ? 'min-h-[44px]' : 'min-h-[40px]',
        CONTROL,
        CHIP_TONE[kind][active ? 'on' : 'off'],
      )}
    >
      {children}
    </button>
  );
}

// touch-manipulation: quick taps on + would otherwise double-tap zoom the public tree on iOS.
const STEP_BUTTON = cn(
  'flex size-[40px] touch-manipulation items-center justify-center rounded-full bg-surface text-xl font-bold leading-none transition-all duration-150 enabled:hover:text-brand-cyan enabled:active:scale-90 disabled:opacity-30',
  CONTROL,
);

export function Stepper({
  value,
  min,
  max,
  onChange,
  removeAtMin,
}: {
  value: number;
  min: number;
  max: number;
  onChange(next: number): void;
  /** `−` at the minimum stays live and passes min - 1: the cart reads that as remove. */
  removeAtMin?: boolean;
}) {
  const { tg } = useSurface();
  const removes = removeAtMin && value <= min;
  const step = (next: number) => {
    tg?.haptic('light');
    onChange(next);
  };
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 p-1">
      <button
        type="button"
        aria-label={removes ? 'Видалити' : 'Зменшити кількість'}
        disabled={value <= min && !removeAtMin}
        onClick={() => step(value - 1)}
        className={cn(STEP_BUTTON, removes && 'text-brand-red')}
      >
        −
      </button>
      <span aria-live="polite" className="min-w-7 text-center text-base font-extrabold tabular-nums">
        {value}
      </span>
      <button
        type="button"
        aria-label="Збільшити кількість"
        disabled={value >= max}
        onClick={() => step(value + 1)}
        className={STEP_BUTTON}
      >
        +
      </button>
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-1 text-base font-black uppercase tracking-wider text-muted">{children}</h2>
  );
}

/** A text link on the web; in the Mini App the events Mini App's pill, with its own wording. */
export function PageBack({ label, tgLabel }: { label: string; tgLabel?: string }) {
  const { base, kind } = useSurface();
  const parent = parentOf(usePathname(), base);
  if (!parent) return null;
  if (kind === 'tg') {
    return (
      <Link
        href={parent}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-surface px-3.5 py-2 text-xs font-bold text-muted shadow-sm transition-all hover:border-white/20 hover:text-fg',
          CONTROL,
        )}
      >
        ← {tgLabel ?? label}
      </Link>
    );
  }
  return (
    <Link
      href={parent}
      className={cn(
        'group inline-flex min-h-[44px] items-center gap-2 rounded-lg text-sm font-bold text-brand-cyan transition-opacity hover:opacity-70',
        CONTROL,
      )}
    >
      <span aria-hidden className="transition-transform duration-200 group-hover:-translate-x-0.5">
        ←
      </span>
      {label}
    </Link>
  );
}

// ---- Photos -------------------------------------------------------------------

/**
 * The whole photo, never cropped: contain over its own blurred copy, in a square box.
 * `full` marks the page's main photo: the thumbnail is shown at once and the full image paints over it.
 */
export function Photo({
  thumb,
  full,
  alt,
  className,
}: {
  thumb: string | null;
  full?: string;
  alt: string;
  className?: string;
}) {
  const loading = full ? 'eager' : 'lazy';
  return (
    <span
      className={cn(
        'relative block aspect-square overflow-hidden bg-gradient-to-br from-surface-2 to-surface',
        className,
      )}
    >
      {thumb ? (
        <>
          {/* ponytail: a blur layer on each card; replace it with bg-surface-2 in lists if scroll stutters on weak Android. */}
          <img
            src={thumb}
            alt=""
            aria-hidden="true"
            loading={loading}
            decoding="async"
            className="absolute -left-[14%] -top-[14%] h-[128%] w-[128%] max-w-none object-cover blur-[20px] brightness-[.45]"
          />
          {/* The key drops the old element, or a colour switch keeps the old photo until the new one loads. */}
          <img
            key={full ?? thumb}
            src={full ?? thumb}
            alt={alt}
            loading={loading}
            decoding="async"
            style={full ? { background: `center / contain no-repeat url("${thumb}")` } : undefined}
            className="absolute inset-0 h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.04]"
          />
        </>
      ) : (
        <CoverPlaceholder seed={alt} />
      )}
    </span>
  );
}

/**
 * Lightbox content. Tap enlarges to 250%, native scrolling pans, tap goes back.
 * ponytail: no pinch inside the Mini App, where the viewport forbids it; about 50 lines of touch
 * handling if buyers ask. The public tree gets browser pinch from its own viewport.
 */
export function Zoomable({ src, thumb, alt }: { src: string; thumb: string; alt: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [big, setBig] = useState(false);

  const toggle = (e: MouseEvent<HTMLImageElement>) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    setBig((b) => !b);
    // Keep the tapped point under the finger.
    requestAnimationFrame(() => {
      const el = box.current;
      if (el) el.scrollTo(x * el.scrollWidth - el.clientWidth / 2, y * el.scrollHeight - el.clientHeight / 2);
    });
  };

  return (
    <div
      ref={box}
      className="flex h-[88dvh] w-[92vw] overflow-auto overscroll-contain"
      onClick={(e) => e.stopPropagation()}
    >
      <img
        src={src}
        alt={alt}
        onClick={toggle}
        style={{ background: `center / contain no-repeat url("${thumb}")` }}
        className={
          big
            ? 'm-auto w-[250%] max-w-none shrink-0 cursor-zoom-out'
            : 'h-full w-full cursor-zoom-in object-contain'
        }
      />
    </div>
  );
}
