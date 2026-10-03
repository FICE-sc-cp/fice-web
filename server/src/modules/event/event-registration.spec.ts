import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { resolveValidatedTelegramUser } from '../../auth/init-data.util';
import { CreateEventRegistrationDto } from './dto/create-event-registration.dto';
import { EventService } from './event.service';

jest.mock('../../auth/init-data.util', () => ({
  ...jest.requireActual('../../auth/init-data.util'),
  resolveValidatedTelegramUser: jest.fn(),
}));

const resolveUser = resolveValidatedTelegramUser as jest.MockedFunction<
  typeof resolveValidatedTelegramUser
>;

const EVENT = {
  id: 'e1',
  name: 'Event',
  date: new Date('2099-11-01T18:00:00Z'),
  hasTime: true,
  isDraft: false,
  noRegistration: false,
  location: null,
  registrationCloseDate: null,
  maxRegistrations: null,
  allowedFaculties: [],
  questions: [],
};

const dto = (
  extra: Partial<CreateEventRegistrationDto> = {},
): CreateEventRegistrationDto =>
  ({
    fullName: 'Іван Іваненко',
    telegramTag: '@victim',
    group: 'ІП-31',
    ...extra,
  }) as CreateEventRegistrationDto;

describe('EventService.register identity', () => {
  let prisma: any;
  let userBot: any;
  let env: Record<string, string>;
  let service: EventService;

  beforeEach(() => {
    resolveUser.mockReset();
    env = {};
    prisma = {
      event: { findUnique: jest.fn().mockResolvedValue(EVENT) },
      blockedUser: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      eventRegistration: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(({ data }: any) =>
          Promise.resolve({
            id: 'r1',
            ticketCode: '11111111-2222-3333-4444-555555555555',
            fullName: data.fullName,
            group: data.group,
            telegramTag: data.telegramTag,
            telegramUserId: data.telegramUserId,
            paymentStatus: data.paymentStatus,
          }),
        ),
      },
      botUser: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'victim-bot-user',
          telegramId: 999n,
          username: 'victim',
        }),
        upsert: jest.fn().mockResolvedValue({ id: 'b1' }),
      },
      pendingWebRegistration: { create: jest.fn().mockResolvedValue({}) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
    userBot = {
      getUsername: () => 'fice_student_bot',
      getMiniAppUrl: () => 'https://fice-sc.kpi.ua/app',
      sendTicketToUser: jest.fn().mockResolvedValue(true),
      sendMessageToUser: jest.fn().mockResolvedValue(true),
    };
    service = new EventService(
      prisma,
      { get: (key: string) => env[key] } as never,
      {} as never,
      userBot,
    );
  });

  describe('website (no initData)', () => {
    it('never binds to an existing BotUser by the typed tag', async () => {
      await service.register('e1', dto());

      expect(prisma.botUser.findFirst).not.toHaveBeenCalled();
      expect(prisma.eventRegistration.create).not.toHaveBeenCalled();
      expect(userBot.sendTicketToUser).not.toHaveBeenCalled();
      expect(userBot.sendMessageToUser).not.toHaveBeenCalled();
      expect(prisma.pendingWebRegistration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ telegramTag: '@victim' }),
        }),
      );
    });

    it('answers only with what the confirmation modal needs', async () => {
      const result = await service.register('e1', dto());

      expect(Object.keys(result).sort()).toEqual([
        'botUrl',
        'requiresBotStart',
        'token',
      ]);
      expect(result).toMatchObject({
        requiresBotStart: true,
        botUrl: expect.stringMatching(
          /^https:\/\/t\.me\/fice_student_bot\?start=reg_[0-9a-f]{32}$/,
        ),
      });
    });

    it.each(['%', '_____', '@%denys', 'den_%'])(
      'rejects the wildcard-like tag %p',
      async (telegramTag) => {
        await expect(
          service.register('e1', dto({ telegramTag })),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.pendingWebRegistration.create).not.toHaveBeenCalled();
      },
    );
  });

  describe('Mini App (validated initData)', () => {
    beforeEach(() => {
      resolveUser.mockReturnValue({
        telegramId: 42n,
        username: 'Attacker',
        staffName: 'Attacker',
      });
    });

    it('takes the username from initData, not from the form', async () => {
      await service.register('e1', dto({ telegramTag: '@victim' }), 'init');

      expect(prisma.eventRegistration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            telegramTag: '@attacker',
            telegramUserId: 42n,
          }),
        }),
      );
      expect(userBot.sendTicketToUser).toHaveBeenCalledWith(
        42n,
        expect.anything(),
        expect.anything(),
      );
    });

    it('does not let the form overwrite BotUser.username', async () => {
      await service.register('e1', dto({ telegramTag: '@victim' }), 'init');

      const call = prisma.botUser.upsert.mock.calls[0][0];
      expect(call.where).toEqual({ telegramId: 42n });
      expect(call.create.username).toBe('attacker');
      expect(call.update.username).toBe('attacker');
      expect(
        JSON.stringify(call, (_k, v) =>
          typeof v === 'bigint' ? String(v) : v,
        ),
      ).not.toContain('victim');
    });

    it('checks for duplicates by exact tag and id, never with ILIKE', async () => {
      await service.register('e1', dto(), 'init');

      expect(prisma.eventRegistration.findFirst).toHaveBeenCalledWith({
        where: {
          eventId: 'e1',
          OR: [{ telegramUserId: 42n }, { telegramTag: '@attacker' }],
        },
      });
    });

    it('does not return the ticket code or the Telegram id', async () => {
      const result = await service.register('e1', dto(), 'init');

      expect(result).toEqual({ id: 'r1', paymentStatus: 'NOT_REQUIRED' });
    });

    it('refuses a blocked Telegram account even under a new tag', async () => {
      prisma.blockedUser.findFirst.mockImplementation(({ where }: any) =>
        Promise.resolve(
          where.OR.some((c: any) => c.telegramUserId === 42n)
            ? { id: 'blk', telegramTag: '@old_tag', telegramUserId: 42n }
            : null,
        ),
      );

      await expect(
        service.register('e1', dto(), 'init'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.eventRegistration.create).not.toHaveBeenCalled();
    });

    it('requires a Telegram username', async () => {
      resolveUser.mockReturnValue({ telegramId: 42n, staffName: 'No Name' });

      await expect(
        service.register('e1', dto(), 'init'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.eventRegistration.create).not.toHaveBeenCalled();
    });

    it('ignores telegramUserId in the body outside AUTH_DISABLED', async () => {
      resolveUser.mockReset();
      await service.register('e1', dto({ telegramUserId: '42' }));

      expect(prisma.eventRegistration.create).not.toHaveBeenCalled();
      expect(prisma.pendingWebRegistration.create).toHaveBeenCalled();
    });
  });
});
