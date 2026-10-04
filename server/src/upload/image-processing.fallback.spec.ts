import type { Logger as NestLogger } from '@nestjs/common';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';
import type * as ImageProcessing from './image-processing';

describe('reencodeImage without sharp', () => {
  let dir: string;
  let mod: typeof ImageProcessing;
  let warn: jest.SpyInstance;
  const SMALL = { maxDimension: 240, quality: 80 };

  const photo = (width: number, height: number) =>
    sharp({ create: { width, height, channels: 3, background: '#3366cc' } })
      .withExif({
        IFD0: { Make: 'TestPhone' },
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '50/1 27/1 0/1' },
      })
      .jpeg()
      .toBuffer();

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'fice-nosharp-'));
    jest.resetModules();
    jest.doMock('sharp', () => {
      throw new Error(
        'Could not load the "sharp" module using the linuxmusl-x64 runtime\nUnsupported CPU',
      );
    });
    const { Logger } = require('@nestjs/common') as {
      Logger: typeof NestLogger;
    };
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    mod = require('./image-processing') as typeof ImageProcessing;
  });

  afterAll(() => {
    warn.mockRestore();
    rmSync(dir, { recursive: true, force: true });
    jest.dontMock('sharp');
  });

  it('downscales a JPEG and drops its EXIF and GPS data', async () => {
    const path = join(dir, 'big.jpg');
    writeFileSync(path, await photo(600, 400));

    const size = await mod.reencodeImage(path, '.jpg', SMALL);

    const meta = await sharp(readFileSync(path)).metadata();
    expect(meta.format).toBe('jpeg');
    expect([meta.width, meta.height]).toEqual([240, 160]);
    expect(meta.exif).toBeUndefined();
    expect(size).toBe(readFileSync(path).length);
  });

  it('applies the EXIF orientation', async () => {
    const path = join(dir, 'rotated.jpg');
    const halves = await sharp({
      create: { width: 200, height: 100, channels: 3, background: '#ff0000' },
    })
      .composite([
        {
          input: {
            create: { width: 100, height: 100, channels: 3, background: '#0000ff' },
          },
          left: 100,
          top: 0,
        },
      ])
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    writeFileSync(path, halves);

    await mod.reencodeImage(path, '.jpg', mod.PUBLIC_IMAGE_PROFILE);

    const out = sharp(readFileSync(path));
    const meta = await out.metadata();
    expect([meta.width, meta.height]).toEqual([100, 200]);
    expect(meta.orientation).toBeUndefined();
    const { data } = await out.raw().toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => {
      const i = (y * 100 + x) * 3;
      return data[i] > data[i + 2] ? 'red' : 'blue';
    };
    expect(pixel(50, 20)).toBe('red');
    expect(pixel(50, 180)).toBe('blue');
  });

  it('keeps a PNG a PNG', async () => {
    const path = join(dir, 'logo.png');
    writeFileSync(
      path,
      await sharp({
        create: {
          width: 600,
          height: 300,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .png()
        .toBuffer(),
    );

    await mod.reencodeImage(path, '.png', SMALL);

    const meta = await sharp(readFileSync(path)).metadata();
    expect(meta.format).toBe('png');
    expect([meta.width, meta.height]).toEqual([240, 120]);
    expect(meta.hasAlpha).toBe(true);
  });

  it('stores a WebP as it is', async () => {
    const path = join(dir, 'pic.webp');
    const bytes = await sharp({
      create: { width: 50, height: 50, channels: 3, background: '#fff' },
    })
      .webp()
      .toBuffer();
    writeFileSync(path, bytes);

    await expect(
      mod.reencodeImage(path, '.webp', mod.PUBLIC_IMAGE_PROFILE),
    ).resolves.toBe(bytes.length);
    expect(readFileSync(path)).toEqual(bytes);
  });

  const pngHeader = (width: number, height: number) => {
    const header = Buffer.alloc(64);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header);
    header.writeUInt32BE(13, 8);
    header.write('IHDR', 12, 'ascii');
    header.writeUInt32BE(width, 16);
    header.writeUInt32BE(height, 20);
    return header;
  };

  it('stores an image too big for the fallback as it is', async () => {
    const header = pngHeader(6000, 5000);
    const path = join(dir, 'large.png');
    writeFileSync(path, header);

    await expect(
      mod.reencodeImage(path, '.png', mod.ADMIN_IMAGE_PROFILE),
    ).resolves.toBe(header.length);
    expect(readFileSync(path)).toEqual(header);
    expect(warn.mock.calls.some(([m]) => /too large/.test(String(m)))).toBe(
      true,
    );
  });

  it('refuses an image over the pixel limit before decoding it', async () => {
    const header = pngHeader(10000, 10000);
    const path = join(dir, 'bomb.png');
    writeFileSync(path, header);

    await expect(
      mod.reencodeImage(path, '.png', mod.PUBLIC_IMAGE_PROFILE),
    ).rejects.toThrow('too many pixels');
    expect(readFileSync(path)).toEqual(header);
  });

  it('warns once that sharp is missing', () => {
    expect(mod.loadSharp()).toBeNull();
    const missing = warn.mock.calls.filter(([m]) =>
      String(m).includes('sharp is unavailable'),
    );
    expect(missing).toHaveLength(1);
    expect(warn.mock.calls[0][0]).toContain('sharp is unavailable');
    expect(warn.mock.calls[0][0]).toContain('runtime Unsupported CPU');
  });
});
