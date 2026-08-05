import { forwardRef, InputHTMLAttributes, useId } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const errorId = `${inputId}-error`;
    return (
      <div className="flex w-full flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-semibold text-muted">
          {label}
        </label>
        <input
          ref={ref}
          {...props}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'rounded-xl border bg-surface px-4 py-3 text-fg outline-none transition-colors placeholder:text-subtle',
            error ? 'border-brand-red' : 'border-border focus:border-brand-cyan',
            className,
          )}
        />
        {error && (
          <span id={errorId} className="text-xs font-medium text-brand-red">
            {error}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
