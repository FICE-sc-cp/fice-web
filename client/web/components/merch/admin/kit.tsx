'use client';

import { useEffect, useRef, useState, type FocusEvent, type ReactNode } from 'react';
import { priceText } from '@/lib/merch';
import type { AdminTemplate, AdminVariant } from '@/lib/merch-types';
import { cn, plural } from '@/lib/utils';
import { CONTROL, Empty, PageBack, SECONDARY_CLASS, Spinner, errorText } from '../ui';
import { NO_ACCESS } from './useAdminState';

/** The server's fixed size of a product without sizes. Never shown. */
export const NO_SIZE = '-';

// ---- Variant axes: order is sizeIndex * 100 + colorIndex, as in merch-rules.ts -------

export const sizesOf = (variants: AdminVariant[]) => [
  ...new Set(
    [...variants]
      .sort((a, b) => Math.floor(a.order / 100) - Math.floor(b.order / 100))
      .map((v) => v.size),
  ),
];

export const colorsOf = (variants: AdminVariant[]) => [
  ...new Set(
    [...variants]
      .sort((a, b) => (a.order % 100) - (b.order % 100))
      .map((v) => v.color)
      .filter(Boolean),
  ),
];

export const colorsText = (n: number) => plural(n, ['колір', 'кольори', 'кольорів']);
export const sizesText = (n: number) => plural(n, ['розмір', 'розміри', 'розмірів']);

export const lowestPrice = (prices: string[]) =>
  priceText(String(Math.min(...prices.map(Number))));

/** "2 кольори · 5 розмірів · від 500 грн" */
export function templateLine(t: AdminTemplate) {
  const sizes = t.sizes.filter((s) => s !== NO_SIZE).length;
  return [
    t.colors.length > 0 && colorsText(t.colors.length),
    sizes > 0 && sizesText(sizes),
    t.prices.length > 0 && `від ${lowestPrice(t.prices.map((p) => p.price))} грн`,
  ]
    .filter(Boolean)
    .join(' · ');
}

// ---- Small behaviours -------------------------------------------------------------

/** The server's sentence, or the list's own words for a lost connection. */
export const failText = (err: unknown) => errorText(err, 'Не вдалося зберегти');

/** Rethrows with failText, for useAction, whose own fallback is meant for buyers. */
export const saving = <T,>(request: Promise<T>) =>
  request.catch((err: unknown) => {
    throw new Error(failText(err));
  });

/** E8: clears the keyboard. Android resizes a moment late, iOS slides over the page. */
export const scrollOnFocus = (e: FocusEvent<HTMLElement>) => {
  const field = e.currentTarget;
  setTimeout(() => field.scrollIntoView({ block: 'center' }), 300);
};

/** iOS slides the keyboard over the page, so anything fixed to the bottom has to rise with it. */
export function useKeyboardInset(on = true) {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const view = window.visualViewport;
    if (!on || !view) return;
    const update = () =>
      setInset(Math.max(0, Math.round(window.innerHeight - view.height - view.offsetTop)));
    view.addEventListener('resize', update);
    view.addEventListener('scroll', update);
    return () => {
      view.removeEventListener('resize', update);
      view.removeEventListener('scroll', update);
    };
  }, [on]);
  return on ? inset : 0;
}

const TWO_TAP_GAP_MS = 400;

/** Two-tap confirm: the first tap arms a key, the second runs the action, 4 s resets it. */
export function useTwoTap() {
  const [armed, setArmed] = useState<number | string | null>(null);
  const armedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const tap = (key: number | string, action: () => void) => {
    // One habitual double tap is not a confirmation: the new label has not been read yet.
    if (armed === key && Date.now() - armedAt.current < TWO_TAP_GAP_MS) return;
    clearTimeout(timer.current);
    if (armed === key) {
      setArmed(null);
      action();
      return;
    }
    setArmed(key);
    armedAt.current = Date.now();
    timer.current = setTimeout(() => setArmed(null), 4000);
  };
  return { armed, tap };
}

/** Reorder taps can outrun the network: one request in flight, the newest list replaces any waiting one. */
export function useLatestOrder(
  send: (ids: number[]) => Promise<unknown>,
  onFail: (err: unknown) => void,
) {
  const running = useRef(false);
  const waiting = useRef<number[] | null>(null);
  return async (ids: number[]) => {
    waiting.current = ids;
    if (running.current) return;
    running.current = true;
    try {
      while (waiting.current) {
        const batch = waiting.current;
        waiting.current = null;
        await send(batch);
      }
    } catch (err) {
      waiting.current = null;
      onFail(err);
    } finally {
      running.current = false;
    }
  };
}

export type Move = 'up' | 'down' | 'top';

export function moved(ids: number[], id: number, move: Move) {
  const from = ids.indexOf(id);
  const rest = ids.filter((x) => x !== id);
  const to = move === 'top' ? 0 : Math.max(0, from + (move === 'up' ? -1 : 1));
  rest.splice(to, 0, id);
  return rest;
}

// ---- Look -------------------------------------------------------------------------

export const ICONS = {
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  up: 'M12 19V5m-6 6l6-6 6 6',
  down: 'M12 5v14m6-6l-6 6-6-6',
  top: 'M5 4h14M12 20V9m-5 5l5-5 5 5',
  sort: 'M7 4v15m-4-4l4 4 4-4M17 20V5m-4 4l4-4 4 4',
  pencil: 'M4 20h4L19 9a2.1 2.1 0 00-3-3L5 17l-1 3zM14 8l3 3',
  upload: 'M12 16V5m-5 5l5-5 5 5M5 20h14',
  chevron: 'M9 5l7 7-7 7',
  template: 'M4 6a2 2 0 012-2h12a2 2 0 012 2v3H4V6zM4 9v9a2 2 0 002 2h4V9M10 9h10v9a2 2 0 01-2 2h-8',
};

export function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg
      className={cn('size-5', className)}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

/** Spec F: every admin touch target is at least 44 px. */
export const SECONDARY = cn(SECONDARY_CLASS, 'min-h-11');
/** Same as ui/Input, for rows with no visible label. */
export const BARE_INPUT =
  'w-full rounded-xl border border-border bg-surface px-4 py-3 text-base text-fg outline-none transition-colors placeholder:text-subtle focus:border-brand-cyan';
export const LIST_CLASS =
  'divide-y divide-border/60 overflow-hidden rounded-3xl border border-border bg-surface';
export const HINT_CLASS = 'px-1 text-xs leading-relaxed text-subtle';
export const ROUND_BUTTON = cn(
  'flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-xl text-muted transition-all duration-150 hover:text-fg active:scale-90 disabled:pointer-events-none disabled:opacity-25',
  CONTROL,
);

/** One tappable row of a sheet. */
export const SHEET_ROW = cn(
  'flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-base font-bold transition-colors hover:bg-white/5 active:bg-white/10',
  CONTROL,
);

/** Back link, eyebrow and title: one head for every admin screen. */
export function ScreenHead({
  back = 'Управління товарами',
  title,
  aside,
}: {
  back?: string;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <header className="space-y-1.5">
      <PageBack label={back} />
      <div className="px-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-black uppercase tracking-wider text-brand-purple">
            Адмін
          </span>
          {aside}
        </div>
        <h1 className="mt-0.5 text-2xl font-black leading-tight">{title}</h1>
      </div>
    </header>
  );
}

/** What a screen shows until the first state arrives. */
export function Gate({ error, refresh }: { error: string | null; refresh(): Promise<void> }) {
  if (!error) return <Spinner />;
  const denied = error === NO_ACCESS;
  return (
    <Empty
      icon={denied ? '🔒' : '⚠️'}
      title={error}
      action={
        !denied && (
          <button type="button" onClick={() => void refresh()} className={SECONDARY}>
            Спробувати ще раз
          </button>
        )
      }
    />
  );
}

/** One of a few modes: the status of the list, the layer of the matrix. */
export function Segmented<T extends string>({
  value,
  options,
  disabled,
  onChange,
  className,
}: {
  value: T;
  options: readonly (readonly [T, string])[];
  disabled?: boolean;
  onChange(next: T): void;
  className?: string;
}) {
  return (
    <div
      className={cn('grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-bg p-1', className)}
    >
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          disabled={disabled}
          onClick={() => onChange(id)}
          className={cn(
            'min-h-11 rounded-lg px-2.5 text-[13px] font-extrabold transition-colors disabled:opacity-50',
            CONTROL,
            value === id ? 'bg-brand-cyan/15 text-brand-cyan' : 'text-muted hover:text-fg',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function MoveButtons({
  first,
  last,
  label,
  onMove,
  className,
}: {
  first: boolean;
  last: boolean;
  label: string;
  onMove(move: Move): void;
  className?: string;
}) {
  const buttons = [
    { move: 'up', icon: ICONS.up, text: 'вгору', off: first },
    { move: 'down', icon: ICONS.down, text: 'вниз', off: last },
    { move: 'top', icon: ICONS.top, text: 'на початок', off: first },
  ] as const;
  return buttons.map((b) => (
    <button
      key={b.move}
      type="button"
      disabled={b.off}
      aria-label={`${label}: ${b.text}`}
      onClick={() => onMove(b.move)}
      className={cn(ROUND_BUTTON, className)}
    >
      <Icon d={b.icon} />
    </button>
  ));
}

/** The rows of the template sheet, in the list and in the form. null is `Без шаблону`. */
export function TemplatePicker({
  templates,
  onPick,
}: {
  templates: AdminTemplate[];
  onPick(template: AdminTemplate | null): void;
}) {
  return (
    <>
      {templates.map((t) => (
        <button key={t.id} type="button" onClick={() => onPick(t)} className={SHEET_ROW}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-purple/15 text-brand-purple">
            <Icon d={ICONS.template} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate">{t.name}</span>
            <span className="block truncate text-[13px] font-semibold text-muted">
              {templateLine(t)}
            </span>
          </span>
          <Icon d={ICONS.chevron} className="size-4 shrink-0 text-subtle" />
        </button>
      ))}
      <button type="button" onClick={() => onPick(null)} className={SHEET_ROW}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
          <Icon d={ICONS.plus} />
        </span>
        <span className="flex-1">Без шаблону</span>
        <Icon d={ICONS.chevron} className="size-4 shrink-0 text-subtle" />
      </button>
    </>
  );
}

/**
 * Bottom sheet on the native dialog: the top layer, Esc and the focus trap come for free.
 * Content mounts on open, so a sheet that reopens starts clean. Needs iOS 15.4, as does dvh.
 * ponytail: a tap on Telegram's Back button leaves the screen rather than closing the sheet,
 * because the surface owns the one global handler. Add a sheet stack there if it ever annoys.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose(): void;
  title: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const keyboard = useKeyboardInset(open);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      el.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-label={title}
      onClose={onClose}
      // A tap on the backdrop lands on the dialog itself; the panel takes every other tap.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ bottom: keyboard }}
      className="mx-auto mb-0 mt-auto max-h-none w-full max-w-md bg-transparent text-fg backdrop:bg-black/70 open:motion-safe:animate-[su-rise_0.28s_cubic-bezier(0.22,0.7,0.2,1)]"
    >
      <div className="max-h-[80dvh] overflow-y-auto overscroll-contain rounded-t-3xl border border-b-0 border-border bg-surface px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl shadow-black/60">
        <div className="mb-1 flex items-center justify-between gap-3 pl-3">
          <h2 className="min-w-0 truncate text-lg font-black">{title}</h2>
          <button type="button" aria-label="Закрити" onClick={onClose} className={ROUND_BUTTON}>
            <Icon d={ICONS.close} />
          </button>
        </div>
        {open && children}
      </div>
    </dialog>
  );
}
