import { mkdtempSync, rmSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';
import {
  ADMIN_IMAGE_PROFILE,
  isProcessableImage,
  PUBLIC_IMAGE_PROFILE,
  reencodeImage,
} from './image-processing';

describe('reencodeImage', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'fice-img-'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const photoWithGps = async (name: string, width: number, height: number) => {
    const path = join(dir, name);
    await sharp({
      create: { width, height, channels: 3, background: '#3366cc' },
    })
      .withExif({
        IFD0: { Make: 'TestPhone', Orientation: '1' },
        IFD3: {
          GPSLatitudeRef: 'N',
          GPSLatitude: '50/1 27/1 0/1',
          GPSLongitudeRef: 'E',
          GPSLongitude: '30/1 31/1 0/1',
        },
      })
      .jpeg()
      .toFile(path);
    return path;
  };

  it('strips EXIF and GPS metadata', async () => {
    const path = await photoWithGps('gps.jpg', 800, 600);
    expect((await sharp(path).metadata()).exif).toBeDefined();

    await reencodeImage(path, '.jpg', PUBLIC_IMAGE_PROFILE);

    const meta = await sharp(path).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.format).toBe('jpeg');
  });

  it('downscales admin images to the admin limit', async () => {
    const path = await photoWithGps('big.jpg', 4000, 3000);
    const size = await reencodeImage(path, '.jpg', ADMIN_IMAGE_PROFILE);

    const meta = await sharp(path).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBe(1920);
    expect(size).toBe(statSync(path).size);
  });

  it('keeps receipts large enough to read', async () => {
    const path = await photoWithGps('receipt.jpg', 1200, 2600);
    await reencodeImage(path, '.jpg', PUBLIC_IMAGE_PROFILE);

    const meta = await sharp(path).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(2600);
  });

  it('keeps PNG transparency and format', async () => {
    const path = join(dir, 'logo.png');
    await sharp({
      create: {
        width: 300,
        height: 200,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toFile(path);

    await reencodeImage(path, '.png', ADMIN_IMAGE_PROFILE);

    const meta = await sharp(path).metadata();
    expect(meta.format).toBe('png');
    expect(meta.hasAlpha).toBe(true);
  });

  it('applies EXIF orientation before dropping it', async () => {
    const path = join(dir, 'rotated.jpg');
    await sharp({
      create: { width: 400, height: 200, channels: 3, background: '#fff' },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toFile(path);
    expect((await sharp(path).metadata()).orientation).toBe(6);

    await reencodeImage(path, '.jpg', PUBLIC_IMAGE_PROFILE);

    const meta = await sharp(path).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(400);
    expect(meta.orientation).toBeUndefined();
  });

  it('only processes raster images, never PDFs', () => {
    expect(isProcessableImage('.JPG')).toBe(true);
    expect(isProcessableImage('.webp')).toBe(true);
    expect(isProcessableImage('.pdf')).toBe(false);
  });
});
