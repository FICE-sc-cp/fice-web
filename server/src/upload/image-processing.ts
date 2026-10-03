import { rename, stat, unlink } from 'fs/promises';
import sharp from 'sharp';

sharp.cache(false);
sharp.concurrency(1);

export interface ImageProfile {
  maxDimension: number;
  quality: number;
}

export const ADMIN_IMAGE_PROFILE: ImageProfile = {
  maxDimension: 1920,
  quality: 82,
};

export const PUBLIC_IMAGE_PROFILE: ImageProfile = {
  maxDimension: 3200,
  quality: 90,
};

const MAX_INPUT_PIXELS = 50_000_000;

export function isProcessableImage(ext: string): boolean {
  return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext.toLowerCase());
}

export async function reencodeImage(
  filePath: string,
  ext: string,
  profile: ImageProfile,
): Promise<number> {
  const tmpPath = `${filePath}.tmp`;
  let pipeline = sharp(filePath, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize({
      width: profile.maxDimension,
      height: profile.maxDimension,
      fit: 'inside',
      withoutEnlargement: true,
    });

  switch (ext.toLowerCase()) {
    case '.png':
      pipeline = pipeline.png({ compressionLevel: 9, palette: false });
      break;
    case '.webp':
      pipeline = pipeline.webp({ quality: profile.quality });
      break;
    default:
      pipeline = pipeline.jpeg({ quality: profile.quality, mozjpeg: true });
  }

  try {
    await pipeline.toFile(tmpPath);
    await rename(tmpPath, filePath);
  } catch (err) {
    await unlink(tmpPath).catch(() => undefined);
    throw err;
  }
  return (await stat(filePath)).size;
}
