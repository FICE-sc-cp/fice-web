import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { BotService } from '../../bot/bot.service';
import type { PrismaService } from '../../database/prisma.service';
import * as ExcelJS from 'exceljs';
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

describe('a saved name of a group shara', () => {
  it('stays for the starosta; the presidium clears it', async () => {
    let awards = [{ id: 'a1', slot: 0, studentName: 'Іваненко Іван' }];
    const prisma = {
      departmentMember: {
        findMany: () => Promise.resolve([{ telegramTag: '@boss' }]),
      },
      shariStarosta: {
        findFirst: ({ where }: { where: Where }) =>
          Promise.resolve(
            where.OR.some((c) => c.telegramId === 7n)
              ? { group: 'ІП-41', telegramTag: '@starosta', telegramId: 7n }
              : null,
          ),
        findUnique: () => Promise.resolve(null),
      },
      shariAdmin: { findFirst: () => Promise.resolve(null) },
      shariStudent: { findMany: () => Promise.resolve([]) },
      shara: {
        findUnique: () =>
          Promise.resolve({ id: 's1', group: 'ІП-41', quantity: 2, awards }),
        findMany: () => Promise.resolve([]),
      },
      shariAward: {
        deleteMany: ({ where }: { where: { id: { in: string[] } } }) => {
          awards = awards.filter((a) => !where.id.in.includes(a.id));
          return Promise.resolve();
        },
        createMany: ({ data }: { data: typeof awards }) => {
          awards = [...awards, ...data];
          return Promise.resolve();
        },
      },
      $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
      siteSetting: { findMany: () => Promise.resolve([]) },
    };
    const service = new ShariService(
      prisma as unknown as PrismaService,
      { get: () => undefined } as unknown as ConfigService,
      {} as BotService,
    );
    const starosta = user(7, 'starosta');
    const boss = user(1, 'boss');

    for (const names of [['Петренко Петро'], ['', 'Петренко Петро'], []]) {
      await expect(
        service.setAwards(starosta, 's1', names),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
    await expect(
      service.setAwards(starosta, 's1', ['Іваненко Іван', 'іваненко іван']),
    ).rejects.toBeInstanceOf(BadRequestException);
    await service.setAwards(starosta, 's1', [
      'Іваненко Іван',
      'Петренко Петро',
    ]);
    expect(awards.map((a) => a.studentName)).toEqual([
      'Іваненко Іван',
      'Петренко Петро',
    ]);

    await service.setAwards(boss, 's1', ['', 'Петренко Петро']);
    await service.setAwards(starosta, 's1', [
      'Сидоренко Сидір',
      'Петренко Петро',
    ]);
    expect(awards.map((a) => a.studentName)).toEqual([
      'Петренко Петро',
      'Сидоренко Сидір',
    ]);
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

describe('the electives import', () => {
  it('hands per-group shari on an elective to its teacher, keeping awards', async () => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('x');
    ws.addRow(['Course', 'Semestr', 'Group', 'Student']);
    ws.addRow(['Основи Linux', '1', 'ІП-41', 'Іваненко Іван Іванович']);
    const file = Buffer.from(
      (await workbook.xlsx.writeBuffer()) as ArrayBuffer,
    );
    const shari = [
      {
        id: 'linux',
        teacherId: 't1',
        discipline: 'Основи Linux',
        group: 'ІП-41',
        quantity: 2,
      },
      {
        id: 'db',
        teacherId: 't1',
        discipline: 'Бази даних',
        group: 'ІП-41',
        quantity: 1,
      },
    ];
    const awards = [
      { sharaId: 'linux', group: null as string | null },
      { sharaId: 'db', group: null as string | null },
    ];
    const prisma = {
      departmentMember: {
        findMany: () => Promise.resolve([{ telegramTag: '@boss' }]),
      },
      shariStarosta: { findFirst: () => Promise.resolve(null) },
      shariAdmin: { findFirst: () => Promise.resolve(null) },
      shariElectiveStudent: {
        deleteMany: () => Promise.resolve(),
        createMany: () => Promise.resolve(),
      },
      shariTeacher: { findMany: () => Promise.resolve([]) },
      shara: {
        findMany: () => Promise.resolve(shari.filter((s) => s.group)),
        update: ({ where, data }: { where: { id: string }; data: object }) =>
          Promise.resolve(
            Object.assign(shari.find((s) => s.id === where.id)!, data),
          ),
      },
      shariAward: {
        updateMany: ({
          where,
          data,
        }: {
          where: { sharaId: string };
          data: { group: string };
        }) => {
          for (const a of awards)
            if (a.sharaId === where.sharaId) a.group = data.group;
          return Promise.resolve();
        },
      },
      $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
    };
    const service = new ShariService(
      prisma as unknown as PrismaService,
      { get: () => undefined } as unknown as ConfigService,
      {} as BotService,
    );

    await service.importElectives(user(1, 'boss'), file);
    expect(shari.map((s) => s.group)).toEqual([null, 'ІП-41']);
    expect(awards.map((a) => a.group)).toEqual(['ІП-41', null]);
  });
});
