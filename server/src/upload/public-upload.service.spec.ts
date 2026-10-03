import { HttpException } from '@nestjs/common';
import { unlink } from 'fs/promises';
import {
  PUBLIC_UPLOAD_DAILY_QUOTA_BYTES,
  PublicUploadService,
  UNREFERENCED_GRACE_MS,
} from './public-upload.service';

jest.mock('fs/promises', () => ({
  unlink: jest.fn().mockResolvedValue(undefined),
}));

const NOW = new Date('2026-12-01T12:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);

function setup(rows: any[], referenced: string[] = [], usedBytes = 0) {
  const prisma: any = {
    publicUpload: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { size: usedBytes } }),
      findMany: jest.fn().mockResolvedValueOnce(rows).mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
    $queryRaw: jest.fn().mockResolvedValue(referenced.map((url) => ({ url }))),
  };
  return { prisma, service: new PublicUploadService(prisma) };
}

describe('PublicUploadService quota', () => {
  it('allows uploads under the daily per-IP quota', async () => {
    const { service } = setup([], [], 100 * 1024 * 1024);
    await expect(
      service.assertQuota('ip', 5 * 1024 * 1024, NOW),
    ).resolves.toBeUndefined();
  });

  it('answers 429 once the daily per-IP quota would be exceeded', async () => {
    const { service } = setup([], [], PUBLIC_UPLOAD_DAILY_QUOTA_BYTES - 1024);
    await expect(service.assertQuota('ip', 4096, NOW)).rejects.toBeInstanceOf(
      HttpException,
    );
  });
});

describe('PublicUploadService.collectGarbage', () => {
  beforeEach(() => (unlink as jest.Mock).mockClear());

  it('deletes a public upload nobody has referenced for 24 hours', async () => {
    const { prisma, service } = setup([
      {
        id: '1',
        filename: 'a.jpg',
        unreferencedSince: ago(UNREFERENCED_GRACE_MS),
      },
    ]);
    const result = await service.collectGarbage(NOW);

    expect(result.deleted).toBe(1);
    expect(unlink).toHaveBeenCalledWith(expect.stringMatching(/a\.jpg$/));
    expect(prisma.publicUpload.delete).toHaveBeenCalledWith({
      where: { id: '1' },
    });
  });

  it('keeps an unreferenced upload younger than 24 hours', async () => {
    const { prisma, service } = setup([
      { id: '1', filename: 'a.jpg', unreferencedSince: ago(60_000) },
    ]);
    await service.collectGarbage(NOW);

    expect(unlink).not.toHaveBeenCalled();
    expect(prisma.publicUpload.delete).not.toHaveBeenCalled();
  });

  it('keeps referenced uploads and resets their clock', async () => {
    const { prisma, service } = setup(
      [
        {
          id: '1',
          filename: 'a.jpg',
          unreferencedSince: ago(UNREFERENCED_GRACE_MS * 3),
        },
      ],
      ['/uploads/a.jpg'],
    );
    const result = await service.collectGarbage(NOW);

    expect(result.referenced).toBe(1);
    expect(unlink).not.toHaveBeenCalled();
    expect(prisma.publicUpload.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { unreferencedSince: null },
    });
  });

  it('starts the 24-hour clock when a reference disappears', async () => {
    const { prisma, service } = setup([
      { id: '1', filename: 'a.jpg', unreferencedSince: null },
    ]);
    await service.collectGarbage(NOW);

    expect(unlink).not.toHaveBeenCalled();
    expect(prisma.publicUpload.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { unreferencedSince: NOW },
    });
  });
});
