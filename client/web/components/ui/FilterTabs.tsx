'use client';

import { cn } from '@/lib/utils';

export interface FilterOption<T> {
  value: T;
  label: string;
}

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan [-webkit-tap-highlight-color:transparent]';

/** A row that scrolls sideways on a phone instead of wrapping into a ragged second line. */
function Scroller({ center, children }: { center: boolean; children: React.ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      <div className={cn('flex w-max', center && 'mx-auto')}>{children}</div>
    </div>
  );
}

/** One choice out of several: a quiet track with the active segment lit. */
export function FilterTabs<T extends string | number | null>({
  label,
  options,
  value,
  onChange,
  center = true,
}: {
  label: string;
  options: FilterOption<T>[];
  value: T;
  onChange(next: T): void;
  center?: boolean;
}) {
  return (
    <Scroller center={center}>
      <div
        role="group"
        aria-label={label}
        className="flex gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5"
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={cn(
                'whitespace-nowrap rounded-xl px-4 py-2 text-[14px] font-bold transition-all duration-200 active:scale-[0.97]',
                FOCUS,
                active
                  ? 'bg-white text-stone-950 shadow-[0_6px_18px_-8px_rgba(255,255,255,0.5)]'
                  : 'text-muted hover:bg-white/[0.06] hover:text-fg',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </Scroller>
  );
}
