import {
  escapeLikePattern,
  findActiveBlock,
  resolveTelegramUserId,
} from './blocklist';

const block = (extra: Record<string, unknown> = {}) => ({
  id: 'b1',
  telegramTag: '@blocked',
  telegramUserId: null,
  isBlocked: true,
  ...extra,
});

describe('findActiveBlock', () => {
  it('matches by tag or by Telegram user id', async () => {
    const prisma: any = {
      blockedUser: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    await findActiveBlock(prisma, '@new_tag', 42n);

    expect(prisma.blockedUser.findFirst).toHaveBeenCalledWith({
      where: {
        isBlocked: true,
        OR: [{ telegramTag: '@new_tag' }, { telegramUserId: 42n }],
      },
    });
  });

  it('matches by tag only when the account is not verified yet', async () => {
    const prisma: any = {
      blockedUser: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    await findActiveBlock(prisma, '@someone');

    expect(prisma.blockedUser.findFirst).toHaveBeenCalledWith({
      where: { isBlocked: true, OR: [{ telegramTag: '@someone' }] },
    });
  });

  it('remembers the Telegram id of a verified account blocked by tag', async () => {
    const prisma: any = {
      blockedUser: {
        findFirst: jest.fn().mockResolvedValue(block()),
        update: jest.fn(),
      },
    };
    await findActiveBlock(prisma, '@blocked', 42n);

    expect(prisma.blockedUser.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { telegramUserId: 42n },
    });
  });

  it('does not overwrite a stored id', async () => {
    const prisma: any = {
      blockedUser: {
        findFirst: jest.fn().mockResolvedValue(block({ telegramUserId: 7n })),
        update: jest.fn(),
      },
    };
    await findActiveBlock(prisma, '@blocked', 42n);

    expect(prisma.blockedUser.update).not.toHaveBeenCalled();
  });
});

describe('resolveTelegramUserId', () => {
  it('escapes LIKE wildcards in the username', async () => {
    const prisma: any = {
      botUser: { findMany: jest.fn().mockResolvedValue([]) },
    };
    await resolveTelegramUserId(prisma, 'den_ys');

    expect(prisma.botUser.findMany.mock.calls[0][0].where).toEqual({
      username: { equals: 'den\\_ys', mode: 'insensitive' },
    });
  });

  it('returns the id only for an unambiguous match', async () => {
    const one: any = {
      botUser: { findMany: jest.fn().mockResolvedValue([{ telegramId: 5n }]) },
    };
    const two: any = {
      botUser: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ telegramId: 5n }, { telegramId: 6n }]),
      },
    };

    expect(await resolveTelegramUserId(one, 'denys')).toBe(5n);
    expect(await resolveTelegramUserId(two, 'denys')).toBeUndefined();
  });
});

describe('escapeLikePattern', () => {
  it('escapes %, _ and backslash', () => {
    expect(escapeLikePattern('a%b_c\\d')).toBe('a\\%b\\_c\\\\d');
  });
});
