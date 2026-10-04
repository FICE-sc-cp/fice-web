import type { Logger as NestLogger } from '@nestjs/common';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type * as ImageProcessing from './image-processing';

describe('reencodeImage without sharp', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'fice-nosharp-'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
    jest.dontMock('sharp');
  });

  it('stores the upload as it is and warns only once', async () => {
    jest.resetModules();
    jest.doMock('sharp', () => {
      throw new Error(
        'Could not load the "sharp" module using the linuxmusl-x64 runtime\nUnsupported CPU',
      );
    });
    const { Logger } = require('@nestjs/common') as {
      Logger: typeof NestLogger;
    };
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const mod = require('./image-processing') as typeof ImageProcessing;

    const path = join(dir, 'photo.jpg');
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5]);
    writeFileSync(path, bytes);

    await expect(
      mod.reencodeImage(path, '.jpg', mod.ADMIN_IMAGE_PROFILE),
    ).resolves.toBe(bytes.length);
    await expect(
      mod.reencodeImage(path, '.png', mod.PUBLIC_IMAGE_PROFILE),
    ).resolves.toBe(bytes.length);

    expect(readFileSync(path)).toEqual(bytes);
    expect(mod.loadSharp()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('sharp is unavailable');
    expect(warn.mock.calls[0][0]).toContain('runtime Unsupported CPU');
    warn.mockRestore();
  });
});
