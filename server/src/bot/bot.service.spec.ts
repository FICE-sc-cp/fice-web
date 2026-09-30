import { Bot } from 'grammy';
import { BotService } from './bot.service';

const GROUP = -1003994384697;
const USER = {
  id: 1092797798,
  is_bot: false,
  first_name: 'Denys',
  username: 'denys',
};

type Handler = (ctx: any, next: () => Promise<void>) => Promise<void>;

describe('BotService department people harvesting', () => {
  let service: BotService;
  let prisma: any;
  let participants: any;
  let handlers: Record<string, Handler>;
  let rows: { id: string; name: string; telegramChatId: string | null }[];
  let env: Record<string, string | undefined>;

  const next = jest.fn(() => Promise.resolve());

  const message = (
    extra: Record<string, unknown> = {},
    chat: Record<string, unknown> = {},
  ) => ({
    chat: { id: GROUP, type: 'supergroup', ...chat },
    from: USER,
    message: { message_id: 1, ...extra },
  });

  const send = async (ctx: any) => {
    await handlers.message(ctx, next);
  };

  const harvestedInto = () =>
    participants.upsertFromTelegram.mock.calls.map((c: any[]) => c[1]);

  beforeEach(() => {
    rows = [
      {
        id: 'projects',
        name: 'Проєктний департамент',
        telegramChatId: String(GROUP),
      },
      {
        id: 'education',
        name: 'Департамент якості освіти',
        telegramChatId: String(GROUP),
      },
    ];
    env = {};
    prisma = {
      department: {
        findMany: jest.fn(({ where }: any) =>
          Promise.resolve(
            where?.OR
              ? rows.filter(
                  (r) =>
                    r.telegramChatId === where.OR[0].telegramChatId ||
                    (r.telegramChatId ?? '').startsWith(
                      where.OR[1].telegramChatId.startsWith,
                    ),
                )
              : rows.filter((r) => r.telegramChatId !== null),
          ),
        ),
        update: jest.fn(({ where, data }: any) => {
          const row = rows.find((r) => r.id === where.id);
          if (row) row.telegramChatId = data.telegramChatId;
          return Promise.resolve(row);
        }),
      },
    };
    participants = {
      upsertFromTelegram: jest.fn(() =>
        Promise.resolve({ id: 'p1', isNew: true, needsAvatar: false }),
      ),
      setAvatar: jest.fn(),
    };
    const config = { get: jest.fn((key: string) => env[key]) };
    service = new BotService(config as any, prisma, participants);
    handlers = {};
    const fakeBot = {
      on: (filter: string, handler: Handler) => {
        handlers[filter] = handler;
      },
    };
    (service as any).registerProjectChatHarvesting(fakeBot);
    next.mockClear();
  });

  it('adds the sender to every department linked to the group', async () => {
    await send(message());
    expect(harvestedInto()).toEqual(['projects', 'education']);
    expect(participants.upsertFromTelegram).toHaveBeenCalledWith(
      expect.objectContaining({ id: USER.id, username: 'denys' }),
      'education',
    );
  });

  it('collects people from every topic when only the group id is set', async () => {
    await send(
      message(
        { is_topic_message: true, message_thread_id: 12 },
        { is_forum: true },
      ),
    );
    await send(message({}, { is_forum: true }));
    expect(harvestedInto()).toEqual([
      'projects',
      'education',
      'projects',
      'education',
    ]);
  });

  it('respects a department limited to one topic', async () => {
    rows = [
      { id: 'projects', name: 'P', telegramChatId: `${GROUP}/5` },
      { id: 'education', name: 'E', telegramChatId: String(GROUP) },
    ];
    await send(
      message(
        { is_topic_message: true, message_thread_id: 9 },
        { is_forum: true },
      ),
    );
    expect(harvestedInto()).toEqual(['education']);
    participants.upsertFromTelegram.mockClear();
    await send(
      message(
        { is_topic_message: true, message_thread_id: 5 },
        { is_forum: true },
      ),
    );
    expect(harvestedInto()).toEqual(['projects', 'education']);
  });

  it('ignores messages from other chats and private chats', async () => {
    await send(message({}, { id: -1001 }));
    await send({
      chat: { id: USER.id, type: 'private' },
      from: USER,
      message: {},
    });
    expect(participants.upsertFromTelegram).not.toHaveBeenCalled();
  });

  it('skips bots and messages sent on behalf of a channel or the group', async () => {
    await send({
      ...message(),
      from: { id: 1, is_bot: true, first_name: 'Bot' },
    });
    await send(message({ sender_chat: { id: GROUP, type: 'supergroup' } }));
    expect(participants.upsertFromTelegram).not.toHaveBeenCalled();
  });

  it('adds people who join the group, skipping bots', async () => {
    const joined = [
      { id: 5, is_bot: false, first_name: 'Ann' },
      { id: 6, is_bot: true, first_name: 'SomeBot' },
    ];
    await send({
      ...message({ new_chat_members: joined }),
      from: { id: 7, is_bot: false, first_name: 'Admin' },
    });
    const ids = participants.upsertFromTelegram.mock.calls.map((c: any[]) => [
      c[0].id,
      c[1],
    ]);
    expect(ids).toEqual(
      expect.arrayContaining([
        [7, 'projects'],
        [7, 'education'],
        [5, 'projects'],
        [5, 'education'],
      ]),
    );
    expect(ids).not.toContainEqual([6, 'projects']);
  });

  it('adds members reported by chat_member updates', async () => {
    const update = (status: string, extra: Record<string, unknown> = {}) => ({
      chatMember: {
        chat: { id: GROUP },
        new_chat_member: { status, user: USER, ...extra },
      },
    });
    await handlers.chat_member(update('member'), next);
    await handlers.chat_member(update('left'), next);
    await handlers.chat_member(
      update('restricted', { is_member: false }),
      next,
    );
    expect(harvestedInto()).toEqual(['projects', 'education']);
  });

  it('always passes the update on to later handlers', async () => {
    await send(message());
    await send({
      chat: { id: USER.id, type: 'private' },
      from: USER,
      message: {},
    });
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('picks up a changed chat id right after the department is saved', async () => {
    rows = [{ id: 'projects', name: 'P', telegramChatId: String(GROUP) }];
    await send(message());
    expect(harvestedInto()).toEqual(['projects']);

    rows = [
      { id: 'projects', name: 'P', telegramChatId: String(GROUP) },
      { id: 'education', name: 'E', telegramChatId: String(GROUP) },
    ];
    participants.upsertFromTelegram.mockClear();
    await send(message());
    expect(harvestedInto()).toEqual(['projects']);

    service.invalidateDepartmentChats();
    participants.upsertFromTelegram.mockClear();
    await send(message());
    expect(harvestedInto()).toEqual(['projects', 'education']);
  });

  it('keeps going when saving one person fails', async () => {
    participants.upsertFromTelegram
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce({ id: 'p2', isNew: true, needsAvatar: false });
    await expect(send(message())).resolves.toBeUndefined();
    expect(harvestedInto()).toEqual(['projects', 'education']);
  });

  it('does not add anyone when a member leaves or is removed', async () => {
    await send(message({ left_chat_member: USER }));
    await send({
      ...message({ left_chat_member: USER }),
      from: { id: 7, is_bot: false, first_name: 'Admin' },
    });
    expect(participants.upsertFromTelegram).not.toHaveBeenCalled();
  });

  it('adds someone who joins by themselves only to whole-group departments', async () => {
    rows = [
      { id: 'projects', name: 'P', telegramChatId: `${GROUP}/1` },
      { id: 'education', name: 'E', telegramChatId: String(GROUP) },
    ];
    await send(message({ new_chat_members: [USER] }, { is_forum: true }));
    expect(harvestedInto()).toEqual(['education']);
  });

  it('moves saved chat ids when the group becomes a supergroup', async () => {
    const OLD = -4012345678;
    env.ADMIN_GROUP_CHAT_ID = String(OLD);
    const warn = jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation(() => undefined);
    rows = [
      { id: 'projects', name: 'P', telegramChatId: String(OLD) },
      { id: 'education', name: 'E', telegramChatId: `${OLD}/3` },
      { id: 'media', name: 'M', telegramChatId: '-1000000000001' },
    ];
    await send({
      chat: { id: OLD, type: 'group' },
      from: USER,
      message: { message_id: 2, migrate_to_chat_id: GROUP },
    });
    expect(rows.map((r) => r.telegramChatId)).toEqual([
      String(GROUP),
      `${GROUP}/3`,
      '-1000000000001',
    ]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('ADMIN_GROUP_CHAT_ID'),
    );
    await send({
      chat: { id: GROUP, type: 'supergroup' },
      from: USER,
      message: {
        message_id: 1,
        migrate_from_chat_id: OLD,
        sender_chat: { id: OLD, type: 'group' },
      },
    });
    expect(prisma.department.update).toHaveBeenCalledTimes(2);
    expect(participants.upsertFromTelegram).not.toHaveBeenCalled();
    await send(message());
    expect(harvestedInto()).toEqual(['projects']);
  });

  it('reloads the mapping when a department is saved during a reload', async () => {
    let release!: (value: unknown) => void;
    prisma.department.findMany.mockImplementationOnce(
      () => new Promise((resolve) => (release = resolve)),
    );
    const first = send(message());
    service.invalidateDepartmentChats();
    release(rows.slice(0, 1));
    await first;
    expect(harvestedInto()).toEqual(['projects']);
    participants.upsertFromTelegram.mockClear();
    await send(message());
    expect(harvestedInto()).toEqual(['projects', 'education']);
  });
});

describe('BotService start-up', () => {
  it('collects people before handling /start, so /start in a group counts too', () => {
    const order: string[] = [];
    const proto = Bot.prototype as any;
    const spies = [
      jest.spyOn(proto, 'on').mockImplementation(function (
        this: any,
        filter: any,
      ) {
        order.push(`on:${filter}`);
        return this;
      }),
      jest.spyOn(proto, 'command').mockImplementation(function (
        this: any,
        cmd: any,
      ) {
        order.push(`command:${cmd}`);
        return this;
      }),
      jest.spyOn(proto, 'catch').mockImplementation(() => undefined),
      jest.spyOn(proto, 'start').mockImplementation(() => Promise.resolve()),
    ];
    const config = {
      get: jest.fn((key: string) =>
        key === 'TELEGRAM_BOT_TOKEN' ? '123:abc' : undefined,
      ),
    };
    const service = new BotService(config as any, {} as any, {} as any);
    service.onModuleInit();
    spies.forEach((spy) => spy.mockRestore());
    expect(order.indexOf('on:message')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('on:message')).toBeLessThan(
      order.indexOf('command:start'),
    );
  });
});
