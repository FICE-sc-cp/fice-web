import Image from 'next/image';
import { cn } from '@/lib/utils';

interface PhotoCardProps {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
}

export function PhotoCard({
  src,
  alt,
  className,
  sizes = '(min-width: 1024px) 20rem, 60vw',
}: PhotoCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl shadow-2xl shadow-black/50 ring-1 ring-white/10',
        className,
      )}
    >
      <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />
    </div>
  );
}
