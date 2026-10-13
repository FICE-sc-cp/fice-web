import Image from 'next/image';
import { cn } from '@/lib/utils';
import { isGif, isRemoteImage, isVideo } from '@/lib/uploads';

/**
 * Fills its positioned parent with a cover: MP4/WEBM play as a muted loop,
 * GIFs skip the optimizer so they stay animated, the rest is a normal image.
 */
export function CoverMedia({
  src,
  alt,
  sizes,
  className,
  preload,
  controls,
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  preload?: boolean;
  controls?: boolean;
}) {
  if (isVideo(src)) {
    return (
      <video
        src={src}
        autoPlay
        muted
        loop
        playsInline
        controls={controls}
        preload="metadata"
        aria-label={alt || undefined}
        className={cn('absolute inset-0 h-full w-full', className)}
      />
    );
  }
  return (
    <Image
      src={src}
      unoptimized={isRemoteImage(src) || isGif(src)}
      alt={alt}
      fill
      preload={preload}
      sizes={sizes}
      className={className}
    />
  );
}
