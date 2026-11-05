import { NotFoundException } from '@nestjs/common';
import { NewsService } from './news.service';

describe('NewsService main post', () => {
  const NOW = new Date('2026-11-04T12:00:00Z');
  const news = { id: 'n1', title: 'Новина', isFeatured: true };

  const setup = () => {
    const prisma = {
      news: {
        findFirst: jest.fn().mockResolvedValue(news),
        findUnique: jest.fn().mockResolvedValue(news),
        update: jest.fn().mockResolvedValue(news),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    return { prisma, service: new NewsService(prisma as never) };
  };

  beforeEach(() => jest.useFakeTimers({ now: NOW }));
  afterEach(() => jest.useRealTimers());

  it('takes the chosen post among published ones, else the latest', async () => {
    const { prisma, service } = setup();

    await expect(service.findFeatured()).resolves.toBe(news);
    // A draft or a scheduled post never matches, chosen or not.
    expect(prisma.news.findFirst).toHaveBeenCalledWith({
      where: { isDraft: false, publishDate: { lte: NOW } },
      orderBy: [{ isFeatured: 'desc' }, { publishDate: 'desc' }],
    });
  });

  it('answers 404 when nothing is published', async () => {
    const { prisma, service } = setup();
    prisma.news.findFirst.mockResolvedValue(null);

    await expect(service.findFeatured()).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('unsets the previous main post in the same transaction', async () => {
    const { prisma, service } = setup();

    await expect(service.feature('n1')).resolves.toBe(news);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.news.updateMany).toHaveBeenCalledWith({
      where: { isFeatured: true, id: { not: 'n1' } },
      data: { isFeatured: false },
    });
    expect(prisma.news.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { isFeatured: true },
    });
  });

  it('leaves the current main post alone for an unknown id', async () => {
    const { prisma, service } = setup();
    prisma.news.findUnique.mockResolvedValue(null);

    await expect(service.feature('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.news.updateMany).not.toHaveBeenCalled();
  });
});
