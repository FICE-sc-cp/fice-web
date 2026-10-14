'use client';

import { useState } from 'react';
import { errorText } from '@/lib/shari';
import { cn } from '@/lib/utils';

export const inputClass =
  'w-full rounded-xl border border-border bg-surface px-4 py-3 text-fg outline-none transition-colors placeholder:text-subtle focus:border-brand-cyan disabled:opacity-60';

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

export function Panel({
  title,
  aside,
  className,
  children,
}: {
  title?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn('rounded-2xl border border-border bg-surface/70 p-5 sm:p-7', className)}>
      {(title || aside) && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent" />
    </div>
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return <p className="text-sm font-medium text-brand-red">{children}</p>;
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
        'rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50',
        active
          ? 'border-brand-cyan bg-brand-cyan/15 text-brand-cyan'
          : 'border-border text-muted hover:border-brand-cyan/60 hover:text-fg',
        className,
      )}
      {...props}
    />
  );
}
