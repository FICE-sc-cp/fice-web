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

export const accentText: Record<Accent, string> = {
  cyan: 'text-brand-cyan',
  green: 'text-brand-green',
  orange: 'text-brand-orange',
  magenta: 'text-brand-magenta',
  teal: 'text-brand-teal',
  blue: 'text-brand-blue',
  purple: 'text-brand-purple',
};

const accentHoverShadow: Record<Accent, string> = {
  cyan: 'hover:shadow-brand-cyan/20',
  green: 'hover:shadow-brand-green/20',
  orange: 'hover:shadow-brand-orange/20',
  magenta: 'hover:shadow-brand-magenta/20',
  teal: 'hover:shadow-brand-teal/20',
  blue: 'hover:shadow-brand-blue/20',
  purple: 'hover:shadow-brand-purple/20',
};

interface AccentCardProps extends HTMLAttributes<HTMLDivElement> {
  accent: Accent;
  interactive?: boolean;
}

export function AccentCard({
  accent,
  interactive,
  className,
  ...props
}: AccentCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-transparent p-6 transition-all duration-300',
        accentBorder[accent],
        interactive &&
          cn(
            'hover:-translate-y-1 hover:shadow-xl',
            accentHoverShadow[accent],
          ),
        className,
      )}
      {...props}
    />
  );
}
