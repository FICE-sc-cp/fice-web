import { forwardRef, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, ...props }, ref) => (
    <div className="flex w-full flex-col gap-1.5">
      {label && <label className="text-sm font-semibold text-muted">{label}</label>}
      <select
        ref={ref}
        {...props}
        className={cn(
          'appearance-none rounded-xl border bg-bg-soft px-4 py-3 text-fg outline-none transition-colors',
          error ? 'border-brand-red' : 'border-border focus:border-brand-cyan',
          className,
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs font-medium text-brand-red">{error}</span>}
    </div>
  ),
);

Select.displayName = 'Select';
