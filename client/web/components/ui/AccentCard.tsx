import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { IconGradient } from '@/components/ui/icons';

export type Accent =
  | 'cyan'
  | 'green'
  | 'orange'
  | 'magenta'
  | 'teal'
  | 'blue'
  | 'purple';

export const accentBorder: Record<Accent, string> = {
  cyan: 'border-brand-cyan',
  green: 'border-brand-green',
  orange: 'border-brand-orange',
  magenta: 'border-brand-magenta',
  teal: 'border-brand-teal',
  blue: 'border-brand-blue',
  purple: 'border-brand-purple',
};

export const accentGradient: Record<Accent, IconGradient> = {
  cyan: 'blue',
  green: 'green',
  orange: 'orange',
  magenta: 'magenta',
  teal: 'green',
  blue: 'blue',
  purple: 'magenta',
};

interface AccentCardProps extends HTMLAttributes<HTMLDivElement> {
  accent: Accent;
}

export function AccentCard({ accent, className, ...props }: AccentCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-transparent p-6 transition-colors',
        accentBorder[accent],
        className,
      )}
      {...props}
    />
  );
}
