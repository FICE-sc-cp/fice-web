import { Logger } from '@nestjs/common';
import { readFile, rename, stat, unlink, writeFile } from 'fs/promises';
import { basename } from 'path';
import { TaskQueue } from '../bot/task-queue';
import { imageDimensions, jpegOrientation } from './image-dimensions';
import { applyOrientation } from './orientation';

type Sharp = typeof import('sharp');
type RawImageData = import('jimp').RawImageData;

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
      `sharp is unavailable, uploads are processed by the slower JavaScript fallback: ${reason}`,
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

export const MAX_INPUT_PIXELS = 50_000_000;
export const FALLBACK_MAX_PIXELS = 25_000_000;
const JPEG_DECODE_MEMORY_MB = 400;

const queue = new TaskQueue(1);

export function isProcessableImage(ext: string): boolean {
  return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext.toLowerCase());
}

export function reencodeImage(
  filePath: string,
  ext: string,
  profile: ImageProfile,
): Promise<number> {
  return queue.run(() => {
    const sharp = loadSharp();
    return sharp
      ? reencodeWithSharp(sharp, filePath, ext, profile)
      : reencodeWithJimp(filePath, ext, profile);
  });
}

async function replaceFile(filePath: string, write: (tmp: string) => Promise<void>) {
  const tmpPath = `${filePath}.tmp`;
  try {
    await write(tmpPath);
    await rename(tmpPath, filePath);
  } catch (err) {
    await unlink(tmpPath).catch(() => undefined);
    throw err;
  }
  return (await stat(filePath)).size;
}

async function reencodeWithJimp(
  filePath: string,
  ext: string,
  profile: ImageProfile,
): Promise<number> {
  const format = ext.toLowerCase();
  if (format === '.webp') return (await stat(filePath)).size;

  const input = await readFile(filePath);
  const size = imageDimensions(input);
  if (!size) throw new Error('Unreadable image header');
  const pixels = size.width * size.height;
  if (pixels > MAX_INPUT_PIXELS) {
    throw new Error('Image has too many pixels');
  }
  if (pixels > FALLBACK_MAX_PIXELS) {
    logger.warn(
      `${basename(filePath)} (${size.width}x${size.height}) is too large for the JavaScript fallback, stored as it is`,
    );
    return input.length;
  }

  const { Jimp, defaultFormats } = require('jimp') as typeof import('jimp');
  const mime = format === '.png' ? 'image/png' : 'image/jpeg';
  const codec = defaultFormats.map((f) => f()).find((f) => f.mime === mime);
  if (!codec?.decode) throw new Error(`No decoder for ${mime}`);
  const decode = codec.decode as (
    data: Buffer,
    options?: object,
  ) => RawImageData | Promise<RawImageData>;
  const bitmap = await decode(
    input,
    mime === 'image/jpeg'
      ? {
          maxResolutionInMP: MAX_INPUT_PIXELS / 1_000_000,
          maxMemoryUsageInMB: JPEG_DECODE_MEMORY_MB,
        }
      : undefined,
  );
  const image = Jimp.fromBitmap(bitmap);
  if (
    image.bitmap.width > profile.maxDimension ||
    image.bitmap.height > profile.maxDimension
  ) {
    image.scaleToFit({ w: profile.maxDimension, h: profile.maxDimension });
  }
  if (mime === 'image/jpeg') applyOrientation(image.bitmap, jpegOrientation(input));
  const output =
    format === '.png'
      ? await image.getBuffer('image/png', { deflateLevel: 9 })
      : await image.getBuffer('image/jpeg', { quality: profile.quality });
  return replaceFile(filePath, (tmp) => writeFile(tmp, output));
}

async function reencodeWithSharp(
  sharp: Sharp,
  filePath: string,
  ext: string,
  profile: ImageProfile,
): Promise<number> {
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

  return replaceFile(filePath, async (tmp) => {
    await pipeline.toFile(tmp);
  });
}
