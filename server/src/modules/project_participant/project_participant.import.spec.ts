import { ProjectParticipantSource } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PeopleArchive } from './people-import';
import { ProjectParticipantService } from './project_participant.service';

const MEDIA = 'dept-media';
const MERCH = 'dept-merch';

interface Row {
  id: string;
  departmentId: string | null;
  telegramId: bigint | null;
  fullName: string;
  photo: string | null;
  avatarFileId: string | null;
  source: ProjectParticipantSource;
  hidden: boolean;
}

function memoryDb(rows: Row[]) {
  let next = 0;
  const matches = (r: Row, where: Record<string, any>) =>
    Object.entries(where).every(([k, v]) => {
      if (k === 'photo') return r.photo !== null;
      return (r as any)[k] === v;
    });
  const db = {
    department: {
      findMany: () =>
        Promise.resolve([
          { id: MEDIA, name: 'Медіа' },
          { id: MERCH, name: 'Мерч' },
        ]),
    },
    projectParticipant: {
      findUnique: ({ where }: any) => {
        const { departmentId, telegramId } = where.departmentId_telegramId;
        return Promise.resolve(
          rows.find(
            (r) => r.departmentId === departmentId && r.telegramId === telegramId,
          ) ?? null,
        );
      },
      findFirst: ({ where }: any) =>
        Promise.resolve(rows.find((r) => matches(r, where)) ?? null),
      findMany: ({ where }: any) =>
        Promise.resolve(rows.filter((r) => matches(r, where))),
      create: ({ data }: any) => {
        const row: Row = {
          id: `new-${next++}`,
          hidden: false,
          photo: null,
          avatarFileId: null,
          ...data,
        };
        rows.push(row);
        return Promise.resolve({ id: row.id });
      },
      update: ({ where, data }: any) => {
        Object.assign(rows.find((r) => r.id === where.id)!, data);
        return Promise.resolve({});
      },
    },
  };
  return db as unknown as PrismaService;
}

const row = (over: Partial<Row>): Row => ({
  id: 'r',
  departmentId: MEDIA,
  telegramId: null,
  fullName: 'X',
  photo: null,
  avatarFileId: null,
  source: ProjectParticipantSource.HARVESTED,
  hidden: false,
  ...over,
});

const AVATAR = Buffer.from([0xff, 0xd8, 0xff]);

const archive = (
  people: PeopleArchive['departments'][number]['people'],
  departmentId = MEDIA,
): PeopleArchive => ({
  departments: [{ departmentId, people }],
  invalid: 1,
  skippedByTool: { bots: 3, deleted: 2 },
});

describe('ProjectParticipantService.importPeople', () => {
  it('adds new people with their avatars and reports what was skipped', async () => {
    const rows: Row[] = [];
    const store = jest.fn(() => Promise.resolve('/uploads/a.jpg'));
    const service = new ProjectParticipantService(memoryDb(rows));

    const summary = await service.importPeople(
      archive([
        { telegramId: 1n, fullName: 'Олена Коваль', avatar: AVATAR },
        { telegramId: 2n, fullName: 'Без Фото', avatar: null },
      ]),
      store,
    );

    expect(summary).toEqual({
      added: 2,
      updated: 0,
      skipped: 1,
      skippedByTool: { bots: 3, deleted: 2 },
      unknownDepartments: 0,
      possibleDuplicates: [],
    });
    expect(store).toHaveBeenCalledTimes(1);
    expect(rows[0]).toMatchObject({
      telegramId: 1n,
      departmentId: MEDIA,
      photo: '/uploads/a.jpg',
      source: ProjectParticipantSource.HARVESTED,
      hidden: false,
    });
  });

  it('updates a known person without un-hiding them or replacing their photo', async () => {
    const rows = [
      row({ id: 'h', telegramId: 1n, fullName: 'Old', hidden: true, photo: '/uploads/old.jpg' }),
    ];
    const store = jest.fn(() => Promise.resolve('/uploads/new.jpg'));
    const service = new ProjectParticipantService(memoryDb(rows));

    const summary = await service.importPeople(
      archive([{ telegramId: 1n, fullName: 'New Name', avatar: AVATAR }]),
      store,
    );

    expect(summary.updated).toBe(1);
    expect(rows[0]).toMatchObject({
      fullName: 'New Name',
      hidden: true,
      photo: '/uploads/old.jpg',
    });
    expect(store).not.toHaveBeenCalled();
  });

  it('keeps the name of a manual entry that the bot already linked', async () => {
    const rows = [
      row({
        id: 'm',
        telegramId: 1n,
        fullName: 'Admin Spelling',
        source: ProjectParticipantSource.MANUAL,
      }),
    ];
    const service = new ProjectParticipantService(memoryDb(rows));

    await service.importPeople(
      archive([{ telegramId: 1n, fullName: 'Telegram Name', avatar: AVATAR }]),
      () => Promise.resolve('/uploads/a.jpg'),
    );

    expect(rows[0]).toMatchObject({
      fullName: 'Admin Spelling',
      photo: '/uploads/a.jpg',
    });
  });

  it('lists a manual entry with the same name instead of adding a duplicate', async () => {
    const rows = [
      row({
        id: 'm',
        fullName: 'Дарʼя  Цвілюк',
        source: ProjectParticipantSource.MANUAL,
      }),
      row({ id: 'other', departmentId: MERCH, fullName: 'Іван Петренко', source: ProjectParticipantSource.MANUAL }),
    ];
    const service = new ProjectParticipantService(memoryDb(rows));

    const summary = await service.importPeople(
      archive([
        { telegramId: 1n, fullName: "дар'я цвілюк", avatar: null },
        { telegramId: 2n, fullName: 'Іван Петренко', avatar: null },
      ]),
      () => Promise.resolve(null),
    );

    expect(summary.possibleDuplicates).toEqual([
      { department: 'Медіа', fullName: "дар'я цвілюк" },
    ]);
    expect(summary).toMatchObject({ added: 1, skipped: 2 });
    expect(rows.filter((r) => r.departmentId === MEDIA)).toHaveLength(2);
  });

  it('reuses the avatar a person already has in another department', async () => {
    const rows = [
      row({ id: 't', departmentId: MERCH, telegramId: 1n, photo: '/uploads/twin.jpg', avatarFileId: 'f1' }),
    ];
    const store = jest.fn(() => Promise.resolve('/uploads/new.jpg'));
    const service = new ProjectParticipantService(memoryDb(rows));

    await service.importPeople(
      archive([{ telegramId: 1n, fullName: 'A', avatar: AVATAR }]),
      store,
    );

    expect(store).not.toHaveBeenCalled();
    expect(rows[1]).toMatchObject({
      departmentId: MEDIA,
      photo: '/uploads/twin.jpg',
      avatarFileId: 'f1',
    });
  });

  it('skips departments that no longer exist', async () => {
    const rows: Row[] = [];
    const service = new ProjectParticipantService(memoryDb(rows));

    const summary = await service.importPeople(
      archive([{ telegramId: 1n, fullName: 'A', avatar: null }], 'gone'),
      () => Promise.resolve(null),
    );

    expect(summary).toMatchObject({ unknownDepartments: 1, skipped: 2, added: 0 });
    expect(rows).toHaveLength(0);
  });
});
