import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
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

describe('a teacher link and elective shari', () => {
  const serviceWith = (prisma: object) =>
    new ShariService(
      prisma as unknown as PrismaService,
      { get: () => undefined } as unknown as ConfigService,
      {} as BotService,
    );
  const LINUX = { discipline: 'Основи Linux', groups: ['ІП-41', 'ІП-42'] };

  it('reaches only the recipients of its own elective shari', async () => {
    const shari = [
      { id: 'elective', teacherId: 't1', group: null, awards: [] },
      { id: 'group', teacherId: 't1', group: 'ІП-41', awards: [] },
      { id: 'other', teacherId: 't2', group: null, awards: [] },
    ];
    const award = (sharaId: string) => {
      const s = shari.find((x) => x.id === sharaId)!;
      return {
        id: `a-${sharaId}`,
        studentName: 'Іваненко Іван Іванович',
        group: s.group ? null : 'ІП-41',
        shara: {
          teacherId: s.teacherId,
          group: s.group,
          discipline: LINUX.discipline,
          bonus: '+5 балів',
          condition: null,
          teacher: { fullName: 'Петренко Петро Петрович' },
        },
      };
    };
    type Where = { id: string; teacherId?: string; group?: null };
    const service = serviceWith({
      shariTeacher: {
        findUnique: ({ where }: { where: { token: string } }) =>
          Promise.resolve(where.token === 'link' ? { id: 't1' } : null),
      },
      shara: {
        findFirst: ({ where }: { where: Where }) =>
          Promise.resolve(
            shari.find(
              (s) =>
                s.id === where.id &&
                s.teacherId === where.teacherId &&
                (!('group' in where) || s.group === where.group),
            ) ?? null,
          ),
      },
      shariAward: {
        findUnique: ({ where }: { where: { id: string } }) =>
          Promise.resolve(award(where.id.slice(2))),
      },
      siteSetting: { findMany: () => Promise.resolve([]) },
    });

    for (const id of ['other', 'group']) {
      await expect(
        service.setTeacherAwards('link', id, []),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.teacherCertificate('link', `a-${id}`),
      ).rejects.toBeInstanceOf(NotFoundException);
    }
    await expect(
      service.teacherCertificate('link', 'a-elective'),
    ).resolves.toMatchObject({ group: 'ІП-41' });
    await expect(
      service.teacherCertificate('stolen?', 'a-elective'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('gives an elective for the whole discipline, never per group', async () => {
    const created: unknown[] = [];
    const service = serviceWith({
      shariTeacher: {
        findUnique: () =>
          Promise.resolve({
            id: 't1',
            courses: [LINUX, { discipline: 'Мережі', groups: ['ІП-41'] }],
          }),
      },
      shariElectiveStudent: {
        findMany: () =>
          Promise.resolve([{ discipline: LINUX.discipline, group: 'ІП-41' }]),
      },
      shara: {
        create: ({ data }: { data: unknown }) => {
          created.push(data);
          return Promise.resolve(data);
        },
      },
      siteSetting: { findMany: () => Promise.resolve([]) },
    });
    jest.spyOn(service, 'teacherView').mockResolvedValue({} as never);
    const dto = { discipline: 'Основи  Linux', bonus: '+5 балів', quantity: 3 };

    await expect(
      service.addShari('link', { ...dto, groups: ['ІП-41'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await service.addShari('link', { ...dto, groups: [] });
    expect(created).toEqual([
      {
        teacherId: 't1',
        discipline: LINUX.discipline,
        group: null,
        bonus: '+5 балів',
        condition: null,
        quantity: 3,
      },
    ]);
    // Not an elective: a shara still needs its groups.
    await expect(
      service.addShari('link', { ...dto, discipline: 'Мережі', groups: [] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
