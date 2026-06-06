import { forwardRef, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, className, ...props }, ref) => (
    <div className="flex w-full flex-col gap-1.5 text-left">
      <label className="text-sm font-semibold text-muted">{label}</label>
      <select
        ref={ref}
        {...props}
        className={cn(
          'appearance-none rounded-xl border bg-surface px-4 py-3 text-fg outline-none transition-colors',
          error ? 'border-brand-red' : 'border-border focus:border-brand-cyan',
          className,
        )}
      >
        <option value="" disabled>
          Оберіть варіант...
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <span className="text-xs font-medium text-brand-red">{error}</span>
      )}
    </div>
  ),
);

Select.displayName = 'Select';
