import { forwardRef, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { ChevronIcon } from '@/components/ui/icons';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
  error?: string;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    { label, options, error, className, placeholder = 'Обери варіант...', ...props },
    ref,
  ) => (
    <div className="flex w-full flex-col gap-1.5 text-left">
      <label className="text-sm font-semibold text-muted">{label}</label>
      <div className="relative">
        <select
          ref={ref}
          {...props}
          className={cn(
            'w-full appearance-none rounded-xl border bg-surface px-4 py-3 pr-11 text-fg outline-none transition-colors',
            error ? 'border-brand-red' : 'border-border focus:border-brand-cyan',
            className,
          )}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-subtle">
          <ChevronIcon />
        </span>
      </div>
      {error && (
        <span className="text-xs font-medium text-brand-red">{error}</span>
      )}
    </div>
  ),
);

Select.displayName = 'Select';
