import { forwardRef, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="flex w-full flex-col gap-1.5 text-left">
      <label className="text-sm font-semibold text-muted">{label}</label>
      <textarea
        ref={ref}
        {...props}
        className={cn(
          'min-h-[120px] resize-y rounded-xl border bg-surface px-4 py-3 text-fg outline-none transition-colors placeholder:text-subtle',
          error ? 'border-brand-red' : 'border-border focus:border-brand-cyan',
          className,
        )}
      />
      {error && (
        <span className="text-xs font-medium text-brand-red">{error}</span>
      )}
    </div>
  ),
);

Textarea.displayName = 'Textarea';
