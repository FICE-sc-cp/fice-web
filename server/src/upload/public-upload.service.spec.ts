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

function setup(
  rows: any[],
  referenced: string[] = [],
  usedBytes = 0,
  pending: string[] = [],
) {
  const prisma = {
    publicUpload: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { size: usedBytes } }),
      findMany: jest.fn().mockResolvedValueOnce(rows).mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
    $queryRaw: jest
      .fn()
      .mockResolvedValueOnce(referenced.map((url) => ({ url })))
      .mockResolvedValueOnce(pending.map((url) => ({ url })))
      .mockResolvedValue([]),
  };
  return { prisma, service: new PublicUploadService(prisma as never) };
}

describe('PublicUploadService quota', () => {
  it('allows uploads under the per-IP quota', async () => {
    const { service } = setup([], [], 100 * 1024 * 1024);
    await expect(
      service.assertQuota('ip', 5 * 1024 * 1024),
    ).resolves.toBeUndefined();
  });

  it('answers 429 once the per-IP quota would be exceeded', async () => {
    const { service } = setup([], [], PUBLIC_UPLOAD_DAILY_QUOTA_BYTES - 1024);
    await expect(service.assertQuota('ip', 4096)).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('counts every upload of the IP that no confirmed registration uses, however old', async () => {
    const { prisma, service } = setup([]);
    await service.assertQuota('ip', 1024);

    expect(prisma.publicUpload.aggregate).toHaveBeenCalledWith({
      _sum: { size: true },
      where: { ipHash: 'ip', unreferencedSince: { not: null } },
    });
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

  it('asks the merch tables about receipts and product photos', async () => {
    const { prisma, service } = setup([
      { id: '1', filename: 'a.jpg', unreferencedSince: null },
    ]);
    await service.collectGarbage(NOW);

    const [sql] = prisma.$queryRaw.mock.calls[0] as [{ strings: string[] }];
    const query = sql.strings.join('?');
    expect(query).toContain('"receiptUrl" FROM "MerchOrder"');
    expect(query).toContain('"url" FROM "MerchPhoto"');
    expect(query).toContain('"thumbUrl" FROM "MerchPhoto"');
  });

  it('counts only attached files of answers as used, and asks site registrations apart', async () => {
    const { prisma, service } = setup([
      { id: '1', filename: 'a.jpg', unreferencedSince: null },
    ]);
    await service.collectGarbage(NOW);

    const [[used], [pending]] = prisma.$queryRaw.mock.calls as [
      { strings: string[]; values: unknown[] },
    ][];
    const usedQuery = used.strings.join('?');
    expect(usedQuery).toMatch(
      /FROM "EventRegistrationAnswer"\s+WHERE "value" LIKE '\[\{"url":"\/uploads\/%'/,
    );
    expect(usedQuery).toContain(`strpos(a."value", '"url":"' || u.url || '"')`);
    expect(usedQuery).not.toContain('PendingWebRegistration');
    expect(pending.strings.join('?')).toMatch(
      /"payload"::text AS body FROM "PendingWebRegistration"\s+WHERE "completed" = false AND "expiresAt" > \?/,
    );
    expect(pending.values).toEqual([['/uploads/a.jpg'], NOW]);
  });

  it('keeps counting a file that only an unconfirmed site registration uses', async () => {
    const { prisma, service } = setup(
      [{ id: '1', filename: 'a.mp4', unreferencedSince: ago(60_000) }],
      [],
      0,
      ['/uploads/a.mp4'],
    );
    const result = await service.collectGarbage(NOW);

    expect(result).toEqual({ deleted: 0, referenced: 0, waiting: 1 });
    expect(prisma.publicUpload.update).not.toHaveBeenCalled();
    expect(prisma.publicUpload.delete).not.toHaveBeenCalled();
  });

  it('never deletes a file a live site registration uses, even past the grace period', async () => {
    const { prisma, service } = setup(
      [
        {
          id: '1',
          filename: 'a.mp4',
          unreferencedSince: ago(UNREFERENCED_GRACE_MS * 3),
        },
      ],
      [],
      0,
      ['/uploads/a.mp4'],
    );
    await service.collectGarbage(NOW);

    expect(unlink).not.toHaveBeenCalled();
    expect(prisma.publicUpload.delete).not.toHaveBeenCalled();
    expect(prisma.publicUpload.update).not.toHaveBeenCalled();
  });

  it('counts a file again when only a site registration still uses it', async () => {
    const { prisma, service } = setup(
      [{ id: '1', filename: 'a.mp4', unreferencedSince: null }],
      [],
      0,
      ['/uploads/a.mp4'],
    );
    await service.collectGarbage(NOW);

    expect(prisma.publicUpload.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { unreferencedSince: NOW },
    });
  });

  it('does not ask site registrations about files that something uses', async () => {
    const { prisma, service } = setup(
      [{ id: '1', filename: 'a.jpg', unreferencedSince: null }],
      ['/uploads/a.jpg'],
    );
    await service.collectGarbage(NOW);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('keeps a file that a stored answer links to', async () => {
    const { service } = setup(
      [
        {
          id: '1',
          filename: 'a.pdf',
          unreferencedSince: ago(UNREFERENCED_GRACE_MS * 2),
        },
        {
          id: '2',
          filename: 'b.mov',
          unreferencedSince: ago(UNREFERENCED_GRACE_MS * 2),
        },
      ],
      ['/uploads/a.pdf'],
    );
    const result = await service.collectGarbage(NOW);

    expect(result).toEqual({ deleted: 1, referenced: 1, waiting: 0 });
    expect(unlink).toHaveBeenCalledTimes(1);
    expect(unlink).toHaveBeenCalledWith(expect.stringMatching(/b\.mov$/));
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
