'use client';

import { useState } from 'react';
import { errorText } from '@/lib/shari';
import { cn } from '@/lib/utils';
import { Sphere, type SphereColor } from './decor';

export const inputClass =
  'w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-fg outline-none transition placeholder:text-subtle focus:border-brand-cyan/70 focus:bg-white/[0.07] focus:ring-4 focus:ring-brand-cyan/10 disabled:opacity-60';

/** One mutation at a time, with its error message. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (err) {
      setError(errorText(err));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

/** Glass card of the shari pages. */
export function Panel({
  title,
  icon,
  aside,
  className,
  children,
}: {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        'rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-5 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur-sm sm:p-7',
        className,
      )}
    >
      {(title || aside) && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          {title && (
            <h2 className="flex items-center gap-3 text-xl font-extrabold tracking-tight sm:text-2xl">
              {icon}
              {title}
            </h2>
          )}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/** A numbered sphere before a label: steps of a form or of the process. */
export function Step({
  n,
  color,
  children,
}: {
  n: number;
  color: SphereColor;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 text-xs font-extrabold uppercase tracking-[0.16em] text-muted">
      <Sphere color={color} size={28} className="text-xs">
        {n}
      </Sphere>
      {children}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-20">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-brand-cyan border-t-transparent" />
    </div>
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return <p className="text-sm font-semibold text-brand-red">{children}</p>;
}

export function Banner({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn' | 'ok';
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-5 py-4 text-sm sm:text-base',
        tone === 'info' && 'border-brand-cyan/30 bg-brand-cyan/10 text-fg',
        tone === 'warn' && 'border-amber-500/40 bg-amber-500/10 text-amber-200',
        tone === 'ok' && 'border-brand-green/40 bg-brand-green/10 text-brand-green',
      )}
    >
      {children}
    </div>
  );
}

export function Chip({
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-full border px-4 py-2 text-sm font-bold transition disabled:opacity-50',
        active
          ? 'border-transparent bg-gradient-main text-black shadow-[0_0_24px_-6px_rgba(54,223,255,0.7)]'
          : 'border-white/12 bg-white/[0.04] text-muted hover:border-white/30 hover:text-fg',
        className,
      )}
      {...props}
    />
  );
}

/** Segmented switch between the sections of a page. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: readonly (readonly [T, string])[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <nav className="flex flex-wrap gap-1 self-start rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-1.5">
      {items.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-current={value === id ? 'page' : undefined}
          className={cn(
            'rounded-2xl px-4 py-2 text-sm font-bold transition',
            value === id ? 'bg-gradient-main text-black' : 'text-muted hover:bg-white/[0.06] hover:text-fg',
          )}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
      <span className="font-semibold">{label}</span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={onChange} disabled={disabled} />
      <span className="relative h-7 w-12 shrink-0 rounded-full bg-white/15 transition after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:bg-brand-green peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-cyan peer-disabled:opacity-60" />
    </label>
  );
}

/** "− 3 +": how many shari each group gets. */
export function QuantityStepper({
  value,
  onChange,
  max = 50,
}: {
  value: number;
  onChange: (value: number) => void;
  max?: number;
}) {
  const button =
    'flex size-11 items-center justify-center rounded-xl text-2xl font-bold transition hover:bg-white/10 disabled:opacity-30';
  return (
    <div className="inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.05] p-1">
      <button type="button" aria-label="Менше" className={button} disabled={value <= 1} onClick={() => onChange(value - 1)}>
        −
      </button>
      <span className="w-12 text-center text-2xl font-black tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" aria-label="Більше" className={button} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}
