import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionTitleProps {
  children: ReactNode;
  gradient?: string;
  className?: string;
}

export function SectionTitle({
  children,
  gradient = 'bg-gradient-main',
  className,
}: SectionTitleProps) {
  return (
    <div className="flex justify-center">
      <div className="inline-flex flex-col items-center gap-3">
        <h2
          className={cn(
            'text-center text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl',
            className,
          )}
        >
          {children}
        </h2>
        <span className={cn('h-1.5 w-full rounded-full', gradient)} aria-hidden />
      </div>
    </div>
  );
}
