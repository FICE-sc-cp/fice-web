import { Bot } from 'grammy';
import { UserBotService } from './user-bot.service';

type Handler = (ctx: any) => Promise<void>;

const TOKEN = 'a'.repeat(32);

describe('UserBotService /start reg_ confirmation', () => {
  let startHandler: Handler;
  let service: UserBotService;

  const start = async (ctx: unknown) => {
    await startHandler(ctx);
    await (service as any).registrationQueue.onIdle();
  };
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
      event: {
        findUnique: jest.fn().mockResolvedValue({
          date: new Date('2099-01-01T12:00:00Z'),
          hasTime: true,
          registrationCloseDate: null,
          noRegistration: false,
          isDraft: false,
          maxRegistrations: null,
        }),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    prisma.eventRegistration.count = jest.fn().mockResolvedValue(0);
    prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));

    const env: Record<string, string> = {
      TELEGRAM_BOT_TOKEN: '111:admin',
      USER_BOT_TOKEN: '222:user',
    };
    service = new UserBotService(
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

  it('does not hold up update polling while completing a registration', async () => {
    let release!: (value: unknown) => void;
    prisma.pendingWebRegistration.findUnique.mockReturnValue(
      new Promise((resolve) => (release = resolve)),
    );

    await startHandler(ctxFrom({ username: 'Victim' }));

    expect((service as any).registrationQueue.size).toBe(1);
    release(null);
    await (service as any).registrationQueue.onIdle();
  });

  it('refuses to bind the registration to a different Telegram account', async () => {
    const ctx = ctxFrom({ username: 'attacker' });
    await start(ctx);

    expect(prisma.eventRegistration.create).not.toHaveBeenCalled();
    expect(prisma.pendingWebRegistration.update).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Помилка авторизації'),
    );
  });

  it('refuses an account without a username', async () => {
    const ctx = ctxFrom({});
    await start(ctx);

    expect(prisma.eventRegistration.create).not.toHaveBeenCalled();
  });

  it('binds the registration to the account that owns the typed tag', async () => {
    await start(ctxFrom({ username: 'Victim' }));

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

  it('refuses a confirming account that is blocked by Telegram id', async () => {
    prisma.blockedUser.findFirst.mockResolvedValue({
      id: 'blk',
      telegramTag: '@old_tag',
      telegramUserId: 4242n,
      isBlocked: true,
    });
    const ctx = ctxFrom({ username: 'Victim' });
    await start(ctx);

    expect(prisma.blockedUser.findFirst).toHaveBeenCalledWith({
      where: {
        isBlocked: true,
        OR: [{ telegramTag: '@victim' }, { telegramUserId: 4242n }],
      },
    });
    expect(prisma.eventRegistration.create).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('заблоковано'),
    );
  });

  it('refuses to complete a website registration after the deadline', async () => {
    prisma.event.findUnique.mockResolvedValue({
      date: new Date('2000-01-01T12:00:00Z'),
      hasTime: true,
      registrationCloseDate: null,
      noRegistration: false,
      isDraft: false,
      maxRegistrations: null,
    });
    const ctx = ctxFrom({ username: 'Victim' });
    await start(ctx);

    expect(prisma.eventRegistration.create).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Реєстрацію на цей захід закрито'),
    );
  });

  it('checks for an existing registration by exact tag, never with ILIKE', async () => {
    await start(ctxFrom({ username: 'Victim' }));

    expect(prisma.eventRegistration.findFirst).toHaveBeenCalledWith({
      where: {
        eventId: 'e1',
        OR: [{ telegramUserId: 4242n }, { telegramTag: '@victim' }],
      },
    });
  });
});
