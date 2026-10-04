import { extname } from 'path';
import type { ImageProfile } from './image-processing';

export const OVERSIZED_JPEG_BYTES = 1024 * 1024;

export function needsReencode(
  file: { name: string; bytes: number; width: number; height: number },
  profile: ImageProfile,
): boolean {
  if (Math.max(file.width, file.height) > profile.maxDimension) return true;
  const ext = extname(file.name).toLowerCase();
  return (ext === '.jpg' || ext === '.jpeg') && file.bytes > OVERSIZED_JPEG_BYTES;
}
