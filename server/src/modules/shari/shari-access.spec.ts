import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { BotService } from '../../bot/bot.service';
import type { PrismaService } from '../../database/prisma.service';
import { ShariService } from './shari.service';

type Row = { telegramTag: string; telegramId: bigint | null };
type Where = { OR: Partial<Row>[] };

/** In-memory stand-in for the tables access() reads; evaluates its OR filter. */
function setup(admins: Row[]) {
  const matches = (row: Row, where: Where) =>
    where.OR.some((cond) =>
      Object.entries(cond).every(([k, v]) => row[k as keyof Row] === v),
    );
  const prisma = {
    departmentMember: {
      findMany: () => Promise.resolve([{ telegramTag: '@boss' }]),
    },
    shariStarosta: { findFirst: () => Promise.resolve(null) },
    shariAdmin: {
      findFirst: ({ where }: { where: Where }) =>
        Promise.resolve(admins.find((r) => matches(r, where)) ?? null),
      findUnique: ({ where }: { where: { telegramTag: string } }) =>
        Promise.resolve(
          admins.find((r) => r.telegramTag === where.telegramTag) ?? null,
        ),
      update: ({
        where,
        data,
      }: {
        where: { telegramTag: string };
        data: Partial<Row>;
      }) =>
        Promise.resolve(
          Object.assign(
            admins.find((r) => r.telegramTag === where.telegramTag)!,
            data,
          ),
        ),
      create: ({ data }: { data: Row }) => {
        admins.push({ ...data, telegramId: null });
        return Promise.resolve(data);
      },
      findMany: () =>
        Promise.resolve(admins.map((a) => ({ ...a, addedBy: '@boss' }))),
    },
    siteSetting: { findMany: () => Promise.resolve([]) },
  };
  // No ADMIN_GROUP_CHAT_ID: a presidium tag is enough, like local development.
  const config = { get: () => undefined };
  const service = new ShariService(
    prisma as unknown as PrismaService,
    config as unknown as ConfigService,
    {} as BotService,
  );
  return { service, admins };
}

const user = (telegramId: number, username: string) => ({
  telegramId: BigInt(telegramId),
  username,
  staffName: username,
});

describe('shari access', () => {
  it('gives an added admin the admin, not the presidium, and binds the account', async () => {
    const { service, admins } = setup([
      { telegramTag: '@helper', telegramId: null },
    ]);
    const me = await service.me(user(5, 'Helper'));
    expect(me).toMatchObject({ isAdmin: true, isPresidium: false });
    expect(admins[0].telegramId).toBe(5n);

    // Someone who takes the tag later is nobody; the owner keeps it after a rename.
    await expect(service.me(user(9, 'helper'))).resolves.toMatchObject({
      isAdmin: false,
    });
    await expect(service.me(user(5, 'renamed'))).resolves.toMatchObject({
      isAdmin: true,
    });
  });

  it('lets only the presidium change the admin list', async () => {
    const { service, admins } = setup([
      { telegramTag: '@helper', telegramId: 5n },
    ]);
    await expect(
      service.addAdmin(user(5, 'helper'), '@another'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const boss = user(1, 'boss');
    await expect(service.me(boss)).resolves.toMatchObject({
      isAdmin: true,
      isPresidium: true,
    });
    await service.addAdmin(boss, 'https://t.me/Another');
    expect(admins.map((a) => a.telegramTag)).toEqual(['@helper', '@another']);
  });
});

describe('a shara for a whole elective', () => {
  it('is no starosta’s, even the student’s own one', async () => {
    const prisma = {
      departmentMember: {
        findMany: () => Promise.resolve([{ telegramTag: '@boss' }]),
      },
      // Whoever signs in is the starosta of the student's group.
      shariStarosta: {
        findFirst: () =>
          Promise.resolve({
            group: 'ІП-41',
            telegramTag: '@starosta',
            telegramId: 7n,
          }),
      },
      shariAdmin: { findFirst: () => Promise.resolve(null) },
      shara: {
        findUnique: () =>
          Promise.resolve({ id: 's1', group: null, quantity: 2, awards: [] }),
      },
      shariAward: {
        findUnique: () =>
          Promise.resolve({
            id: 'a1',
            studentName: 'Іваненко Іван Іванович',
            group: 'ІП-41',
            shara: {
              group: null,
              discipline: 'Основи Linux',
              bonus: '+5 балів',
              condition: null,
              teacher: { fullName: 'Петренко Петро Петрович' },
            },
          }),
      },
      siteSetting: { findMany: () => Promise.resolve([]) },
    };
    const service = new ShariService(
      prisma as unknown as PrismaService,
      { get: () => undefined } as unknown as ConfigService,
      {} as BotService,
    );
    const starosta = user(7, 'starosta');

    await expect(service.check('a1')).resolves.toMatchObject({
      group: 'ІП-41',
    });
    await expect(service.certificate(starosta, 'a1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.setAwards(starosta, 's1', ['Хтось Інший']),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.certificate(user(1, 'boss'), 'a1'),
    ).resolves.toMatchObject({
      group: 'ІП-41',
      studentName: 'Іваненко Іван Іванович',
    });
  });
});
