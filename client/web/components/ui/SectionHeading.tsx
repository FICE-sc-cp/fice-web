import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface SectionHeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  align?: 'left' | 'center';
}

export function SectionHeading({
  className,
  align = 'center',
  ...props
}: SectionHeadingProps) {
  return (
    <h2
      className={cn(
        'text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl',
        align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
      {...props}
    />
  );
}
