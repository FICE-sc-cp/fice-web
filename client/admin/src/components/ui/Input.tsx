import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="flex w-full flex-col gap-1.5">
      {label && <label className="text-sm font-semibold text-muted">{label}</label>}
      <input
        ref={ref}
        {...props}
        className={cn(
          'rounded-xl border bg-bg-soft px-4 py-3 text-fg outline-none transition-colors placeholder:text-subtle',
          error ? 'border-brand-red' : 'border-border focus:border-brand-cyan',
          className,
        )}
      />
      {error && <span className="text-xs font-medium text-brand-red">{error}</span>}
    </div>
  ),
);

Input.displayName = 'Input';
