import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function GradientText({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('text-gradient', className)} {...props} />;
}
