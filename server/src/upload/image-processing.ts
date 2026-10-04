import { Logger } from '@nestjs/common';
import { rename, stat, unlink } from 'fs/promises';

type Sharp = typeof import('sharp');

const logger = new Logger('ImageProcessing');
let sharpModule: Sharp | null | undefined;

export function loadSharp(): Sharp | null {
  if (sharpModule !== undefined) return sharpModule;
  try {
    const loaded = require('sharp') as Sharp;
    loaded.cache(false);
    loaded.concurrency(1);
    sharpModule = loaded;
  } catch (err) {
    sharpModule = null;
    const reason = (err instanceof Error ? err.message : String(err))
      .replace(/\s*\n\s*/g, ' ')
      .slice(0, 500);
    logger.warn(
      `sharp is unavailable, uploads are stored as they are (no resize, re-encode or metadata removal): ${reason}`,
    );
  }
  return sharpModule;
}

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
  const sharp = loadSharp();
  if (!sharp) return (await stat(filePath)).size;
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
