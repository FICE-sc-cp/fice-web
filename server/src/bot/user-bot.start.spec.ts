import { Bot } from 'grammy';
import { UserBotService } from './user-bot.service';

type Handler = (ctx: any) => Promise<void>;

const TOKEN = 'a'.repeat(32);

describe('UserBotService /start reg_ confirmation', () => {
  let startHandler: Handler;
  let prisma: any;
  let spies: jest.SpyInstance[];

  beforeEach(() => {
    const proto = Bot.prototype as any;
    spies = [
      jest.spyOn(proto, 'command').mockImplementation(function (
        this: any,
        cmd: any,
        handler: any,
      ) {
        if (cmd === 'start') startHandler = handler;
        return this;
      }),
      jest.spyOn(proto, 'on').mockImplementation(function (this: any) {
        return this;
      }),
      jest.spyOn(proto, 'catch').mockImplementation(() => undefined),
      jest
        .spyOn(proto, 'start')
        .mockImplementation(() => new Promise(() => {})),
    ];

    prisma = {
      botUser: {
        upsert: jest.fn().mockResolvedValue({ id: 'bot-user' }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      pendingWebRegistration: {
        findUnique: jest.fn().mockResolvedValue({
          token: TOKEN,
          eventId: 'e1',
          telegramTag: '@victim',
          completed: false,
          expiresAt: new Date(Date.now() + 60_000),
          payload: { fullName: 'Іван Іваненко', group: 'ІП-31' },
          event: { id: 'e1', name: 'Event', date: new Date(), location: null },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      blockedUser: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      eventRegistration: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'r1',
          fullName: 'Іван Іваненко',
          group: 'ІП-31',
          ticketCode: '11111111-2222-3333-4444-555555555555',
        }),
      },
      eventQuestion: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const env: Record<string, string> = {
      TELEGRAM_BOT_TOKEN: '111:admin',
      USER_BOT_TOKEN: '222:user',
    };
    const service = new UserBotService(
      { get: (key: string) => env[key] } as never,
      prisma,
    );
    jest.spyOn(service, 'sendTicketToUser').mockResolvedValue(true);
    service.onModuleInit();
  });

  afterEach(() => spies.forEach((spy) => spy.mockRestore()));

  const ctxFrom = (from: Record<string, unknown>) => ({
    from: { id: 4242, is_bot: false, first_name: 'Name', ...from },
    chat: { id: 4242, type: 'private' },
    match: `reg_${TOKEN}`,
    reply: jest.fn().mockResolvedValue(undefined),
  });

  it('refuses to bind the registration to a different Telegram account', async () => {
    const ctx = ctxFrom({ username: 'attacker' });
    await startHandler(ctx);

    expect(prisma.eventRegistration.create).not.toHaveBeenCalled();
    expect(prisma.pendingWebRegistration.update).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Помилка авторизації'),
    );
  });

  it('refuses an account without a username', async () => {
    const ctx = ctxFrom({});
    await startHandler(ctx);

    expect(prisma.eventRegistration.create).not.toHaveBeenCalled();
  });

  it('binds the registration to the account that owns the typed tag', async () => {
    await startHandler(ctxFrom({ username: 'Victim' }));

    expect(prisma.eventRegistration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          telegramUserId: 4242n,
          telegramTag: '@victim',
        }),
      }),
    );
    expect(prisma.pendingWebRegistration.update).toHaveBeenCalledWith({
      where: { token: TOKEN },
      data: { completed: true },
    });
  });

  it('checks for an existing registration by exact tag, never with ILIKE', async () => {
    await startHandler(ctxFrom({ username: 'Victim' }));

    expect(prisma.eventRegistration.findFirst).toHaveBeenCalledWith({
      where: {
        eventId: 'e1',
        OR: [{ telegramUserId: 4242n }, { telegramTag: '@victim' }],
      },
    });
  });
});
