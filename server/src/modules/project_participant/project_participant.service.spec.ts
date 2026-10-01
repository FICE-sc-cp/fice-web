import { Prisma, ProjectParticipantSource } from '@prisma/client';
import { ProjectParticipantService } from './project_participant.service';

const DEPT = 'education';
const USER = {
  id: 1092797798,
  first_name: 'Denys',
  last_name: 'H',
  username: 'denys',
};

describe('ProjectParticipantService.upsertFromTelegram', () => {
  let service: ProjectParticipantService;
  let db: any;

  beforeEach(() => {
    db = {
      projectParticipant: {
        findUnique: jest.fn(() => Promise.resolve(null)),
        findFirst: jest.fn(() => Promise.resolve(null)),
        findMany: jest.fn(() => Promise.resolve([])),
        create: jest.fn(() => Promise.resolve({ id: 'new', photo: null })),
        update: jest.fn(() => Promise.resolve({})),
      },
    };
    service = new ProjectParticipantService(db);
  });

  it('adds a new person once per department', async () => {
    await expect(service.upsertFromTelegram(USER, DEPT)).resolves.toEqual({
      id: 'new',
      isNew: true,
      needsAvatar: true,
    });
    expect(db.projectParticipant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          departmentId_telegramId: {
            departmentId: DEPT,
            telegramId: BigInt(USER.id),
          },
        },
      }),
    );
    expect(db.projectParticipant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          telegramId: BigInt(USER.id),
          fullName: 'Denys H',
          telegramTag: '@denys',
          departmentId: DEPT,
          source: ProjectParticipantSource.HARVESTED,
        }),
      }),
    );
  });

  it('updates an already collected person instead of adding them again', async () => {
    db.projectParticipant.findUnique.mockResolvedValue({
      id: 'p1',
      source: ProjectParticipantSource.HARVESTED,
    });
    await expect(service.upsertFromTelegram(USER, DEPT)).resolves.toEqual({
      id: 'p1',
      isNew: false,
      needsAvatar: false,
    });
    expect(db.projectParticipant.create).not.toHaveBeenCalled();
    expect(db.projectParticipant.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: {
        fullName: 'Denys H',
        telegramTag: '@denys',
        lastSeenAt: expect.any(Date),
      },
    });
  });

  it.each(['@denys', '@DENYS', 'denys', ' @Denys '])(
    'links a manual entry tagged %p instead of adding the person twice',
    async (tag) => {
      db.projectParticipant.findMany.mockResolvedValue([
        { id: 'other', photo: null, telegramTag: '@someone' },
        { id: 'manual', photo: '/uploads/a.jpg', telegramTag: tag },
      ]);
      await expect(service.upsertFromTelegram(USER, DEPT)).resolves.toEqual({
        id: 'manual',
        isNew: false,
        needsAvatar: false,
      });
      expect(db.projectParticipant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            departmentId: DEPT,
            telegramId: null,
            telegramTag: { not: null },
          },
        }),
      );
      expect(db.projectParticipant.update).toHaveBeenCalledWith({
        where: { id: 'manual' },
        data: { telegramId: BigInt(USER.id), lastSeenAt: expect.any(Date) },
      });
      expect(db.projectParticipant.create).not.toHaveBeenCalled();
    },
  );

  it('does not treat an underscore in a username as a wildcard', async () => {
    db.projectParticipant.findMany.mockResolvedValue([
      { id: 'manual', photo: null, telegramTag: '@axb' },
    ]);
    await service.upsertFromTelegram({ ...USER, username: 'a_b' }, DEPT);
    expect(db.projectParticipant.create).toHaveBeenCalled();
    expect(db.projectParticipant.update).not.toHaveBeenCalled();
  });

  it('asks for an avatar when the linked manual entry has no photo', async () => {
    db.projectParticipant.findMany.mockResolvedValue([
      { id: 'manual', photo: null, telegramTag: '@denys' },
    ]);
    await expect(service.upsertFromTelegram(USER, DEPT)).resolves.toMatchObject(
      { needsAvatar: true },
    );
  });

  it('keeps the name the admin typed for a linked manual entry', async () => {
    db.projectParticipant.findUnique.mockResolvedValue({
      id: 'manual',
      source: ProjectParticipantSource.MANUAL,
    });
    await service.upsertFromTelegram(USER, DEPT);
    expect(db.projectParticipant.update).toHaveBeenCalledWith({
      where: { id: 'manual' },
      data: { lastSeenAt: expect.any(Date) },
    });
  });

  it('does not look for manual entries when the person has no username', async () => {
    await service.upsertFromTelegram({ id: 5, first_name: 'Ann' }, DEPT);
    expect(db.projectParticipant.findMany).not.toHaveBeenCalled();
  });

  it('cuts very long Telegram names to fit the database', async () => {
    await service.upsertFromTelegram(
      { id: 7, first_name: 'А'.repeat(64), last_name: 'Б'.repeat(64) },
      DEPT,
    );
    const { fullName } = db.projectParticipant.create.mock.calls[0][0].data;
    expect(Array.from(fullName)).toHaveLength(120);
  });

  it('reuses the avatar the person already has in another department', async () => {
    db.projectParticipant.findFirst.mockResolvedValueOnce({
      photo: '/uploads/x.jpg',
      avatarFileId: 'f',
    });
    db.projectParticipant.create.mockResolvedValue({
      id: 'new',
      photo: '/uploads/x.jpg',
    });
    await expect(service.upsertFromTelegram(USER, DEPT)).resolves.toEqual({
      id: 'new',
      isNew: true,
      needsAvatar: false,
    });
  });

  it('does not create a duplicate when two messages race', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: 'test' },
    );
    db.projectParticipant.create.mockRejectedValue(conflict);
    db.projectParticipant.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'p1',
        source: ProjectParticipantSource.HARVESTED,
      });
    await expect(service.upsertFromTelegram(USER, DEPT)).resolves.toEqual({
      id: 'p1',
      isNew: false,
      needsAvatar: false,
    });
    expect(db.projectParticipant.update).toHaveBeenCalledTimes(1);
  });

  it('rethrows other database errors', async () => {
    db.projectParticipant.create.mockRejectedValue(new Error('db down'));
    await expect(service.upsertFromTelegram(USER, DEPT)).rejects.toThrow(
      'db down',
    );
  });
});

describe('ProjectParticipantService.removeOrHideFromTelegram', () => {
  let service: ProjectParticipantService;
  let db: any;

  beforeEach(() => {
    db = {
      projectParticipant: {
        findFirst: jest.fn(() => Promise.resolve(null)),
        delete: jest.fn(() => Promise.resolve({})),
        update: jest.fn(() => Promise.resolve({})),
        findMany: jest.fn(() => Promise.resolve([])),
      },
    };
    service = new ProjectParticipantService(db);
  });

  it('deletes HARVESTED participant when they leave', async () => {
    db.projectParticipant.findFirst.mockResolvedValue({
      id: 'h1',
      source: ProjectParticipantSource.HARVESTED,
      hidden: false,
    });
    const res = await service.removeOrHideFromTelegram(DEPT, BigInt(USER.id));
    expect(res).toEqual({ action: 'deleted' });
    expect(db.projectParticipant.delete).toHaveBeenCalledWith({
      where: { id: 'h1' },
    });
  });

  it('hides MANUAL participant when they leave', async () => {
    db.projectParticipant.findFirst.mockResolvedValue({
      id: 'm1',
      source: ProjectParticipantSource.MANUAL,
      hidden: false,
    });
    const res = await service.removeOrHideFromTelegram(DEPT, BigInt(USER.id));
    expect(res).toEqual({ action: 'hidden' });
    expect(db.projectParticipant.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { hidden: true },
    });
  });

  it('returns none if participant is not found', async () => {
    const res = await service.removeOrHideFromTelegram(DEPT, BigInt(USER.id));
    expect(res).toEqual({ action: 'none' });
  });

  it('findWithTelegramId returns filtered participants with telegramId', async () => {
    db.projectParticipant.findMany.mockResolvedValue([
      { id: '1', telegramId: BigInt(123) },
    ]);
    const res = await service.findWithTelegramId('dept-1');
    expect(res).toHaveLength(1);
    expect(db.projectParticipant.findMany).toHaveBeenCalledWith({
      where: {
        telegramId: { not: null },
        departmentId: 'dept-1',
      },
      select: expect.any(Object),
    });
  });
});
