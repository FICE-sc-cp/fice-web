import { ServiceUnavailableException } from '@nestjs/common';
import { Bot } from 'grammy';
import { MerchChatService } from './merch-chat.service';
import { supportHeader, TEXT } from './merch-texts';

const CHAT = -100123;
const USER = {
  id: 7,
  is_bot: false,
  first_name: 'Тарас',
  last_name: 'Шевченко',
};
const ADMIN = { id: 1001, is_bot: false, first_name: 'Леся' };
const PRIVATE = { id: USER.id, type: 'private', first_name: 'Тарас' };
const GROUP = { id: CHAT, type: 'supergroup', title: 'Адміни мерчу' };
const ME = {
  id: 1,
  is_bot: true,
  first_name: 'Merch',
  username: 'merch_test_bot',
};
const APP = 'https://shop.test/merch-app';
const TOKEN = 'ab'.repeat(16);
const HOUR = 3_600_000;

type Over = Record<string, unknown>;

/** The fields the specs read from a Bot API call. */
interface Payload {
  chat_id: number;
  text: string;
  caption?: string;
  from_chat_id?: number;
  message_id?: number;
  message_thread_id?: number;
  user_id?: number;
  show_alert?: boolean;
  reaction?: { type: string; emoji: string }[];
  reply_parameters?: {
    message_id: number;
    allow_sending_without_reply?: boolean;
  };
  reply_markup?: {
    inline_keyboard?: {
      text: string;
      callback_data?: string;
      web_app?: { url: string };
    }[][];
    keyboard?: { text: string }[][];
    resize_keyboard?: boolean;
  };
}

interface Customer {
  telegramId?: bigint;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  blockedBot?: boolean;
  prompt?: string | null;
  promptUntil?: Date | null;
}

interface Link {
  linkToken: string | null;
  telegramId: bigint | null;
  expiresAt: Date;
}

interface Shop {
  welcomeText: string;
  dayfEnabled: boolean;
  adminChatId: bigint | null;
  adminChatTitle?: string;
  monoJarUrl?: string;
  cardNumber?: string | null;
  ordersThreadId: number | null;
  supportThreadId: number | null;
}

type Audience = { telegramId: bigint }[];

let updateId = 0;
let messageId = 100;

const message = (over: Over = {}) => ({
  message: {
    message_id: ++messageId,
    date: 0,
    chat: PRIVATE,
    from: USER,
    ...over,
  },
});
const text = (value: string, over: Over = {}) =>
  message({ text: value, ...over });
const command = (value: string, over: Over = {}) =>
  text(value, {
    entities: [
      { type: 'bot_command', offset: 0, length: value.split(' ')[0].length },
    ],
    ...over,
  });
const groupText = (value: string, over: Over = {}) =>
  text(value, { chat: GROUP, from: ADMIN, ...over });
const groupMedia = (over: Over) =>
  message({ chat: GROUP, from: ADMIN, ...over });
const groupCommand = (value: string, over: Over = {}) =>
  command(value, { chat: GROUP, from: ADMIN, ...over });
const click = (data: string, over: Over = {}) => ({
  callback_query: {
    id: `q${++messageId}`,
    chat_instance: 'x',
    data,
    from: USER,
    message: {
      message_id: 50,
      date: 0,
      chat: PRIVATE,
      from: ME,
      text: 'Кнопки',
    },
    ...over,
  },
});
const groupClick = (data: string) =>
  click(data, {
    from: ADMIN,
    message: { message_id: 50, date: 0, chat: GROUP, from: ME, text: 'Картка' },
  });
const failure = (code: number, description: string, parameters = {}) => ({
  ok: false,
  error_code: code,
  description,
  parameters,
});

/** The tables the bot touches. A prompt lives here, so a new service instance sees it. */
function fakeDb(
  audience: Audience = [{ telegramId: 11n }, { telegramId: 12n }],
) {
  const customers = new Map<bigint, Customer>();
  const links: Link[] = [];
  const count = (n: number) => Promise.resolve({ count: n });
  return {
    customers,
    links,
    merchCustomer: {
      upsert: jest.fn(
        (args: {
          where: { telegramId: bigint };
          create: Customer;
          update: Customer;
        }): Promise<void> => {
          const row = customers.get(args.where.telegramId);
          customers.set(
            args.where.telegramId,
            row ? { ...row, ...args.update } : { ...args.create },
          );
          return Promise.resolve();
        },
      ),
      findUnique: jest.fn(({ where }: { where: { telegramId: bigint } }) =>
        Promise.resolve(customers.get(where.telegramId) ?? null),
      ),
      updateMany: jest.fn(
        ({
          where,
          data,
        }: {
          where: { telegramId: bigint; prompt?: object };
          data: Customer;
        }) => {
          const row = customers.get(where.telegramId);
          if (!row || (where.prompt && row.prompt === null)) return count(0);
          Object.assign(row, data);
          return count(1);
        },
      ),
      count: jest.fn(() => Promise.resolve(audience.length)),
      findMany: jest.fn(() => Promise.resolve(audience)),
    },
    merchLink: {
      findUnique: jest.fn(({ where }: { where: { linkToken: string } }) =>
        Promise.resolve(
          links.find((l) => l.linkToken === where.linkToken) ?? null,
        ),
      ),
      updateMany: jest.fn(
        ({
          where,
          data,
        }: {
          where: {
            linkToken: string;
            telegramId: null;
            expiresAt: { gt: Date };
          };
          data: Partial<Link>;
        }) => {
          const hit = links.filter(
            (l) =>
              l.linkToken === where.linkToken &&
              l.telegramId === where.telegramId &&
              l.expiresAt > where.expiresAt.gt,
          );
          hit.forEach((l) => Object.assign(l, data));
          return count(hit.length);
        },
      ),
      deleteMany: jest.fn(({ where }: { where: { telegramId: bigint } }) => {
        const hit = links.filter((l) => l.telegramId === where.telegramId);
        hit.forEach((l) => links.splice(links.indexOf(l), 1));
        return count(hit.length);
      }),
    },
    merchProduct: {
      findFirst: jest
        .fn<Promise<{ id: number } | null>, []>()
        .mockResolvedValue({ id: 1 }),
    },
    merchOrder: {
      count: jest.fn(() => Promise.resolve(3)),
      deleteMany: jest.fn(() => count(3)),
    },
  };
}

function harness(
  options: {
    db?: ReturnType<typeof fakeDb>;
    shop?: Partial<Shop>;
    env?: Record<string, string>;
    url?: boolean;
  } = {},
) {
  const db = options.db ?? fakeDb();
  const shop: Shop = {
    welcomeText: 'Вітаємо у магазині!',
    dayfEnabled: false,
    adminChatId: BigInt(CHAT),
    ordersThreadId: null,
    supportThreadId: null,
    ...options.shop,
  };
  const env = options.env ?? { MERCH_OWNER_IDS: String(ADMIN.id) };

  const bot = new Bot('123:fake');
  bot.botInfo = ME as never;
  const calls: { method: string; payload: Payload }[] = [];
  /** What a Telegram method answers, by name; a failure() is thrown as a GrammyError. */
  const replies: Record<string, (payload: Payload) => unknown> = {
    getChatMember: () => ({ status: 'administrator', user: ADMIN }),
  };
  bot.api.config.use(async (_prev, method, raw) => {
    const payload = raw as unknown as Payload;
    calls.push({ method, payload });
    const reply = (await replies[method]?.(payload)) as
      | { ok?: boolean }
      | undefined;
    if (reply?.ok === false) return reply as never;
    return {
      ok: true,
      result: reply ?? {
        message_id: 900 + calls.length,
        date: 0,
        chat: PRIVATE,
      },
    } as never;
  });

  const merchBot = {
    telegram: bot,
    enabled: true,
    appUrl: (path = '') =>
      options.url === false ? undefined : `${APP}${path}`,
    shopConfig: jest.fn(() => Promise.resolve(shop)),
    updateShopConfig: jest.fn((data: Partial<Shop>) => {
      for (const [key, value] of Object.entries(data)) {
        // As Prisma: undefined leaves the column alone.
        if (value !== undefined) Object.assign(shop, { [key]: value });
      }
      return Promise.resolve(shop);
    }),
    isShopAdmin: jest.fn<Promise<boolean>, [number]>().mockResolvedValue(true),
    clearAdminCache: jest.fn(),
    kick: jest.fn(),
  };
  const sync = {
    changeStatus: jest.fn(() =>
      Promise.resolve({ text: 'Статус змінено: 🔄 В роботі' }),
    ),
    resendOpenCards: jest.fn(() => Promise.resolve()),
    setBlocked: jest.fn((telegramId: bigint, blockedBot: boolean) =>
      db.merchCustomer.updateMany({
        where: { telegramId },
        data: { blockedBot },
      }),
    ),
  };
  const service = new MerchChatService(
    db as never,
    merchBot as never,
    sync as never,
    { get: (key: string) => env[key] } as never,
  );
  service.onModuleInit();

  const feed = (update: object) =>
    bot.handleUpdate({ update_id: ++updateId, ...update } as never);
  const send = async (update: object) => {
    await feed(update);
    await service.settled();
  };
  const named = (method: string) =>
    calls.filter((c) => c.method === method).map((c) => c.payload);
  const texts = () => named('sendMessage').map((p) => p.text);
  return {
    db,
    shop,
    calls,
    replies,
    merchBot,
    sync,
    service,
    feed,
    send,
    named,
    texts,
  };
}
type Harness = ReturnType<typeof harness>;

const keyboardOf = (payload: Payload) => payload.reply_markup!.inline_keyboard!;

const broadcastDone = (service: MerchChatService) =>
  (service as unknown as { broadcastDone: Promise<void> }).broadcastDone;

const unix = (msAgo = 0) => Math.floor((Date.now() - msAgo) / 1000);

async function until(ready: () => boolean) {
  for (let tick = 0; tick < 1000 && !ready(); tick++) {
    await new Promise((done) => setImmediate(done));
  }
  expect(ready()).toBe(true);
}

describe('MerchChatService wiring', () => {
  it('registers nothing without a token', () => {
    const service = new MerchChatService(
      {} as never,
      { telegram: undefined, enabled: false } as never,
      {} as never,
      { get: () => undefined } as never,
    );

    expect(() => service.onModuleInit()).not.toThrow();
  });

  it('keeps one chat in order and lets another pass a slow handler', async () => {
    const h = harness();
    let release = () => {};
    h.db.merchCustomer.upsert.mockImplementationOnce(
      () => new Promise<void>((done) => (release = done)),
    );

    await h.feed(command('/start')); // blocked on the DB, the polling loop is free
    await h.feed(text('в тому ж чаті'));
    const other = { ...USER, id: 8 };
    await h.feed(
      command('/start', { from: other, chat: { ...PRIVATE, id: other.id } }),
    );

    await until(() => h.named('sendMessage').some((p) => p.chat_id === 8));
    expect(h.named('sendMessage').some((p) => p.chat_id === USER.id)).toBe(
      false,
    );
    expect(h.db.merchCustomer.findUnique).not.toHaveBeenCalled();

    release();
    await h.service.settled();
    expect(h.named('sendMessage').some((p) => p.chat_id === USER.id)).toBe(
      true,
    );
    expect(h.db.merchCustomer.findUnique).toHaveBeenCalledTimes(1);
  });

  it('shows a Telegram outage as its sentence, never as "no access"', async () => {
    const h = harness();
    const busy = 'Не вдалося перевірити права через Telegram.';
    h.merchBot.isShopAdmin.mockRejectedValue(
      new ServiceUnavailableException(busy),
    );

    await h.send(command('/admin'));
    await h.send(click('admin:dayf'));

    expect(h.texts()).toEqual([busy]);
    expect(h.named('answerCallbackQuery')[0]).toMatchObject({
      text: busy,
      show_alert: true,
    });
  });

  it('answers anything unexpected with the plain sentence', async () => {
    const h = harness();
    h.db.merchCustomer.upsert.mockRejectedValueOnce(new Error('db down'));

    await h.send(command('/start'));

    expect(h.texts()).toEqual([TEXT.somethingWrong]);
  });

  it('survives a failure with nothing to reply to', async () => {
    const h = harness();
    h.db.merchCustomer.updateMany.mockRejectedValueOnce(new Error('db down'));

    await h.send({
      my_chat_member: {
        chat: PRIVATE,
        from: USER,
        date: 0,
        old_chat_member: { status: 'member', user: ME },
        new_chat_member: { status: 'kicked', user: ME, until_date: 0 },
      },
    });

    expect(h.calls).toEqual([]);
  });
});

describe('MerchChatService /start', () => {
  it('stores the customer and sends the two old messages', async () => {
    const h = harness();

    await h.send(command('/start', { from: { ...USER, username: 'Taras_S' } }));

    expect(h.db.customers.get(7n)).toEqual({
      telegramId: 7n,
      username: 'taras_s',
      firstName: 'Тарас',
      lastName: 'Шевченко',
      blockedBot: false,
      prompt: null,
      promptUntil: null,
    });
    const [welcome, hint] = h.named('sendMessage');
    expect(welcome.text).toBe('Вітаємо у магазині!');
    expect(welcome.reply_markup).toEqual({
      keyboard: [[{ text: '💬 Підтримка' }]],
      resize_keyboard: true,
    });
    expect(hint.text).toBe(TEXT.startHint);
    expect(keyboardOf(hint)).toEqual([
      [{ text: '🛍 Відкрити каталог', web_app: { url: APP } }],
    ]);
  });

  it('says pre-orders are off with no active product', async () => {
    const h = harness();
    h.db.merchProduct.findFirst.mockResolvedValue(null);

    await h.send(command('/start'));

    expect(h.texts()[1]).toBe(TEXT.startNoProducts);
  });

  it('goes out without the button when there is no https URL', async () => {
    const h = harness({ url: false });

    await h.send(command('/start'));

    expect(h.named('sendMessage')[1].reply_markup).toBeUndefined();
  });

  it('clears a blocked mark and a prompt', async () => {
    const h = harness();
    h.db.customers.set(7n, {
      blockedBot: true,
      prompt: 'broadcast',
      promptUntil: new Date(Date.now() + HOUR),
    });

    await h.send(command('/start'));

    expect(h.db.customers.get(7n)).toMatchObject({
      blockedBot: false,
      prompt: null,
      promptUntil: null,
    });
  });

  it('stays silent outside a private chat', async () => {
    const h = harness();

    await h.send(groupCommand('/start'));

    expect(h.calls).toEqual([]);
    expect(h.db.merchCustomer.upsert).not.toHaveBeenCalled();
  });

  it('answers item_ with a web_app button and the support hint, no DB read', async () => {
    const h = harness();

    await h.send(command('/start item_42'));

    const [link, hint] = h.named('sendMessage');
    expect(link.text).toBe('Відкрийте товар у каталозі:');
    expect(keyboardOf(link)).toEqual([
      [{ text: '🛍 Відкрити товар', web_app: { url: `${APP}/42` } }],
    ]);
    expect(hint.text).toBe(TEXT.startHint);
    expect(hint.reply_markup?.keyboard).toEqual([[{ text: '💬 Підтримка' }]]);
    expect(h.db.merchProduct.findFirst).not.toHaveBeenCalled();
  });
});

describe('MerchChatService link', () => {
  const pending = (over: Partial<Link> = {}): Link => ({
    linkToken: TOKEN,
    telegramId: null,
    expiresAt: new Date(Date.now() + HOUR),
    ...over,
  });

  it('offers a confirm button that carries the token', async () => {
    const h = harness();
    h.db.links.push(pending());

    await h.send(command(`/start link_${TOKEN}`));

    const [offer] = h.named('sendMessage');
    expect(offer.text).toBe(TEXT.linkOffer);
    expect(keyboardOf(offer)).toEqual([
      [{ text: '✅ Підтвердити', callback_data: `link:${TOKEN}` }],
    ]);
    expect(h.db.links[0].telegramId).toBeNull();
  });

  it.each<[string, Link[]]>([
    ['missing', []],
    ['expired', [pending({ expiresAt: new Date(Date.now() - 1) })]],
    ['used', [pending({ telegramId: 9n })]],
  ])('answers a %s link with the stale text', async (_name, rows) => {
    const h = harness();
    h.db.links.push(...rows);

    await h.send(command(`/start link_${TOKEN}`));

    expect(h.texts()).toEqual([TEXT.linkStale]);
  });

  it('binds on confirm, once, and sends the support keyboard', async () => {
    const h = harness();
    h.db.links.push(pending());

    await h.send(click(`link:${TOKEN}`));
    await h.send(click(`link:${TOKEN}`, { from: { ...USER, id: 8 } }));

    expect(h.db.links[0].telegramId).toBe(7n);
    const [edit] = h.named('editMessageText');
    expect(edit.text).toBe(TEXT.linkDone);
    expect(keyboardOf(edit)).toEqual([
      [{ text: 'Це був не я', callback_data: 'link:off' }],
    ]);
    const [hint] = h.named('sendMessage');
    expect(hint.text).toBe(TEXT.startHint);
    expect(hint.reply_markup?.keyboard).toEqual([[{ text: '💬 Підтримка' }]]);
    expect(h.named('answerCallbackQuery')[1]).toMatchObject({
      text: TEXT.linkStale,
      show_alert: true,
    });
    expect(h.named('editMessageText')).toHaveLength(1);
  });

  it('ignores a forged numeric id and a token outside a private chat', async () => {
    const h = harness();
    h.db.links.push(pending());

    await h.send(click('link:1'));
    await h.send(groupClick(`link:${TOKEN}`));

    expect(h.db.merchLink.updateMany).not.toHaveBeenCalled();
    expect(h.db.links[0].telegramId).toBeNull();
    expect(h.named('answerCallbackQuery')).toHaveLength(2);
    expect(h.named('answerCallbackQuery')[0].text).toBeUndefined();
  });

  it("ends only the sender's sessions on link:off", async () => {
    const h = harness();
    h.db.links.push(
      pending({ telegramId: 7n, linkToken: null }),
      pending({ telegramId: 8n, linkToken: null }),
    );

    await h.send(click('link:off'));

    expect(h.db.links.map((l) => l.telegramId)).toEqual([8n]);
    expect(h.named('answerCallbackQuery')[0].text).toBe(TEXT.linkRevoked);
  });
});

describe('MerchChatService status buttons', () => {
  it('runs in the bound chat, answers from the row, kicks', async () => {
    const h = harness();

    await h.send(groupClick('ostatus:12:in_process'));

    expect(h.sync.changeStatus).toHaveBeenCalledWith(12, 'IN_PROCESS', 'Леся');
    expect(h.named('answerCallbackQuery')[0].text).toBe(
      'Статус змінено: 🔄 В роботі',
    );
    expect(h.merchBot.kick).toHaveBeenCalled();
  });

  it('names the actor with a fallback', async () => {
    const h = harness();
    const noName = { id: 5, is_bot: false, first_name: '' };

    await h.send(
      click('ostatus:12:completed', {
        from: noName,
        message: { message_id: 50, date: 0, chat: GROUP },
      }),
    );

    expect(h.sync.changeStatus).toHaveBeenCalledWith(
      12,
      'COMPLETED',
      'Менеджер',
    );
  });

  it('does nothing from another chat, the old message shape included', async () => {
    const h = harness();

    await h.send(click('ostatus:12:cancelled'));
    await h.send(
      click('ostatus:12:cancelled', {
        message: { message_id: 50, date: 0, chat: PRIVATE },
      }),
    );

    expect(h.sync.changeStatus).not.toHaveBeenCalled();
    expect(h.merchBot.kick).not.toHaveBeenCalled();
    expect(h.named('answerCallbackQuery')[0]).toMatchObject({
      text: TEXT.wrongChat,
      show_alert: true,
    });
  });

  it('answers a malformed button without a word', async () => {
    const h = harness();

    await h.send(groupClick('ostatus:abc:nothing'));

    expect(h.sync.changeStatus).not.toHaveBeenCalled();
    expect(h.named('answerCallbackQuery')).toHaveLength(1);
  });

  it('answers terminal and unknown buttons, so none spins', async () => {
    const h = harness();

    await h.send(click('ignore'));
    await h.send(click('whatever:1'));

    const [terminal, unknown] = h.named('answerCallbackQuery');
    expect(terminal.text).toBe('Замовлення вже завершено');
    expect(unknown.text).toBeUndefined();
  });

  it('survives Telegram refusing an old queued click', async () => {
    const h = harness();
    h.replies.answerCallbackQuery = () =>
      failure(400, 'Bad Request: query is too old');

    await h.send(groupClick('ostatus:12:in_process'));
    await h.send(click('ignore'));

    expect(h.sync.changeStatus).toHaveBeenCalledTimes(1);
    expect(h.merchBot.kick).toHaveBeenCalledTimes(1);
  });
});

describe('MerchChatService support', () => {
  const inSupport = (h: Harness) =>
    h.db.customers.set(7n, {
      prompt: 'support',
      promptUntil: new Date(Date.now() + HOUR),
    });

  it.each<[string, object, string]>([
    ['the command', command('/support'), TEXT.supportPromptCommand],
    ['the button', text('💬 Підтримка'), TEXT.supportPromptButton],
  ])('opens a day-long prompt from %s', async (_name, update, prompt) => {
    const h = harness();
    const now = Date.now();

    await h.send(update);

    expect(h.texts()).toEqual([prompt]);
    const row = h.db.customers.get(7n)!;
    expect(row.prompt).toBe('support');
    expect(row.promptUntil!.getTime()).toBeGreaterThanOrEqual(now + 24 * HOUR);
  });

  it('sends a text as one tagged message', async () => {
    const h = harness({ shop: { supportThreadId: 629 } });
    inSupport(h);

    await h.send(text('Де моє замовлення?'));

    const [relay, sent] = h.named('sendMessage');
    expect(relay.chat_id).toBe(CHAT);
    expect(relay.text).toBe(supportHeader('new', USER, 'Де моє замовлення?'));
    expect(relay.message_thread_id).toBe(629);
    expect(sent.text).toBe('✅ Ваше повідомлення надіслано адміністраторам!');
    expect(h.named('copyMessage')).toEqual([]);
    expect(h.db.customers.get(7n)!.prompt).toBeNull();
  });

  it('sends a photo as one copyMessage with the tag in its caption', async () => {
    const h = harness();
    inSupport(h);

    await h.send(message({ photo: [{ file_id: 'p' }], caption: 'Ось чек' }));

    const [copy] = h.named('copyMessage');
    expect(h.named('copyMessage')).toHaveLength(1);
    expect(copy.chat_id).toBe(CHAT);
    expect(copy.from_chat_id).toBe(USER.id);
    expect(copy.caption).toBe(supportHeader('new', USER, 'Ось чек'));
    expect(h.texts()).toEqual([TEXT.supportSent]);
  });

  it('sends a sticker as a tagged message with the copy under it', async () => {
    const h = harness();
    inSupport(h);

    await h.send(message({ sticker: { file_id: 's' } }));

    const [meta] = h.named('sendMessage');
    expect(meta.text).toBe(supportHeader('new', USER, '(без тексту)'));
    expect(h.named('copyMessage')[0].reply_parameters).toEqual({
      message_id: expect.any(Number) as number,
      allow_sending_without_reply: true,
    });
  });

  it('clears the caption of a copy under a header that outgrew the limit', async () => {
    const h = harness();
    inSupport(h);

    await h.send(
      message({ photo: [{ file_id: 'p' }], caption: 'я'.repeat(1020) }),
    );

    expect(h.named('sendMessage')[0].text).toContain('#T7');
    expect(h.named('copyMessage')[0].caption).toBe('');
  });

  it('keeps a long text inside the message limit', async () => {
    const h = harness();
    inSupport(h);

    await h.send(text('я'.repeat(4096)));

    expect(h.named('sendMessage')[0].text).toHaveLength(4096);
    expect(h.texts()[1]).toBe(TEXT.supportSent);
  });

  it('keeps the prompt when the admin chat refuses', async () => {
    const h = harness();
    inSupport(h);
    h.replies.sendMessage = (p) =>
      p.chat_id === CHAT ? failure(500, 'Internal Server Error') : undefined;

    await h.send(text('Де моє замовлення?'));

    expect(h.texts()).toContain(TEXT.supportFailed);
    expect(h.db.customers.get(7n)!.prompt).toBe('support');
  });

  it('falls back to General when the support thread is wrong', async () => {
    const h = harness({ shop: { supportThreadId: 629 } });
    inSupport(h);
    h.replies.sendMessage = (p) =>
      p.message_thread_id
        ? failure(400, 'Bad Request: message thread not found')
        : undefined;

    await h.send(text('Де моє замовлення?'));

    const [wrong, general, sent] = h.named('sendMessage');
    expect(wrong.message_thread_id).toBe(629);
    expect(general.chat_id).toBe(CHAT);
    expect(general.message_thread_id).toBeUndefined();
    expect(general.text).toContain('#T7');
    expect(sent.text).toBe(TEXT.supportSent);
    expect(h.db.customers.get(7n)!.prompt).toBeNull();
  });

  it('falls back to General for a photo too', async () => {
    const h = harness({ shop: { supportThreadId: 629 } });
    inSupport(h);
    h.replies.copyMessage = (p) =>
      p.message_thread_id
        ? failure(400, 'Bad Request: message thread not found')
        : undefined;

    await h.send(message({ photo: [{ file_id: 'p' }], caption: 'Ось чек' }));

    const copies = h.named('copyMessage');
    expect(copies).toHaveLength(2);
    expect(copies[1].message_thread_id).toBeUndefined();
    expect(copies[1].caption).toContain('#T7');
    expect(h.texts()).toEqual([TEXT.supportSent]);
  });

  it('tells the customer when no chat is bound', async () => {
    const h = harness({ shop: { adminChatId: null } });
    inSupport(h);

    await h.send(text('Де моє замовлення?'));

    expect(h.texts()).toEqual([TEXT.noAdminChat]);
  });

  it("relays a reply to the admin's answer, without a prompt", async () => {
    const h = harness();

    await h.send(
      text('Дякую', {
        reply_to_message: {
          message_id: 5,
          date: 0,
          chat: PRIVATE,
          from: ME,
          text: '💬 Відповідь від адміністратора:\n\nГотово',
        },
      }),
    );

    expect(h.texts()[0]).toBe(supportHeader('reply', USER, 'Дякую'));
    expect(h.texts()[1]).toBe(TEXT.supportSent);
  });

  it('stays silent on anything else', async () => {
    const h = harness();

    await h.send(text('просто текст'));
    await h.send(
      text('цитата', {
        reply_to_message: {
          message_id: 5,
          date: 0,
          chat: PRIVATE,
          from: USER,
          text: 'Відповідь від адміністратора: підробка',
        },
      }),
    );

    expect(h.calls).toEqual([]);
  });

  it('ignores an expired prompt', async () => {
    const h = harness();
    h.db.customers.set(7n, {
      prompt: 'support',
      promptUntil: new Date(Date.now() - 1),
    });

    await h.send(text('запізно'));

    expect(h.calls).toEqual([]);
  });
});

describe('MerchChatService admin replies', () => {
  const tagged = supportHeader('new', USER, 'Де моє замовлення?');
  const toBot = { message_id: 5, date: 0, chat: GROUP, from: ME };

  it('routes by the tag on the replied message', async () => {
    const h = harness();

    await h.send(
      groupText('Вже їде', { reply_to_message: { ...toBot, text: tagged } }),
    );

    expect(h.named('sendMessage')).toHaveLength(1);
    expect(h.named('sendMessage')[0]).toMatchObject({
      chat_id: USER.id,
      text: '💬 Відповідь від адміністратора:\n\nВже їде',
    });
    expect(h.named('setMessageReaction')).toHaveLength(1);
    expect(h.named('setMessageReaction')[0].reaction).toEqual([
      { type: 'emoji', emoji: '👍' },
    ]);
  });

  it('routes by a tag in a caption and copies media with the prefix', async () => {
    const h = harness();

    await h.send(
      groupMedia({
        photo: [{ file_id: 'p' }],
        caption: 'Ось фото',
        reply_to_message: { ...toBot, caption: tagged },
      }),
    );

    expect(h.named('copyMessage')[0]).toMatchObject({
      chat_id: USER.id,
      caption: '💬 Відповідь від адміністратора:\n\nОсь фото',
    });
    expect(h.named('sendMessage')).toEqual([]);
  });

  it('sends a sticker after a text line', async () => {
    const h = harness();

    await h.send(
      groupMedia({
        sticker: { file_id: 's' },
        reply_to_message: { ...toBot, text: tagged },
      }),
    );

    expect(h.texts()).toEqual([
      '💬 Відповідь від адміністратора:\n\n(без тексту)',
    ]);
    expect(h.named('copyMessage')).toHaveLength(1);
  });

  it('keeps a long answer inside the message limit', async () => {
    const h = harness();

    await h.send(
      groupText('я'.repeat(4096), {
        reply_to_message: { ...toBot, text: tagged },
      }),
    );

    expect(h.named('sendMessage')[0].text).toHaveLength(4096);
    expect(h.named('setMessageReaction')).toHaveLength(1);
  });

  it('calls nothing for chatter, not even a config read', async () => {
    const h = harness();

    await h.send(groupText('просто балачки'));
    await h.send(
      groupText('в темі', {
        reply_to_message: { ...toBot, text: 'Створено тему' },
      }),
    );

    expect(h.calls).toEqual([]);
    expect(h.merchBot.isShopAdmin).not.toHaveBeenCalled();
    expect(h.merchBot.shopConfig).not.toHaveBeenCalled();
  });

  it("routes nowhere from a card or someone else's message with #T123", async () => {
    const h = harness();
    const card = '🔔 Замовлення #1\n#T123\nВід: хтось (123)\n\nтекст';

    await h.send(
      groupText('так', { reply_to_message: { ...toBot, text: card } }),
    );
    await h.send(
      groupText('так', {
        reply_to_message: {
          ...toBot,
          from: { id: 55, is_bot: false, first_name: 'Хтось' },
          text: `📩 Підробка\n#T123\nВід: хтось (123)\n\nтекст`,
        },
      }),
    );

    expect(h.calls).toEqual([]);
  });

  it('routes nothing outside the bound chat or from a non-admin', async () => {
    const h = harness();
    const elsewhere = { ...GROUP, id: -100999 };

    await h.send(
      groupText('так', {
        chat: elsewhere,
        reply_to_message: { ...toBot, chat: elsewhere, text: tagged },
      }),
    );
    h.merchBot.isShopAdmin.mockResolvedValue(false);
    await h.send(
      groupText('так', { reply_to_message: { ...toBot, text: tagged } }),
    );

    expect(h.calls).toEqual([]);
  });

  it('reports a blocked customer with no thumbs up', async () => {
    const h = harness();
    h.db.customers.set(7n, { blockedBot: false, prompt: null });
    h.replies.sendMessage = (p) =>
      p.chat_id === USER.id
        ? failure(403, 'Forbidden: bot was blocked')
        : undefined;

    await h.send(
      groupText('Вже їде', { reply_to_message: { ...toBot, text: tagged } }),
    );

    expect(h.named('setMessageReaction')).toEqual([]);
    expect(h.texts()).toContain(TEXT.replyBlocked);
    expect(h.db.customers.get(7n)!.blockedBot).toBe(true);
  });

  it('reports any other failure with no thumbs up', async () => {
    const h = harness();
    h.replies.sendMessage = (p) =>
      p.chat_id === USER.id ? failure(500, 'Internal Server Error') : undefined;

    await h.send(
      groupText('Вже їде', { reply_to_message: { ...toBot, text: tagged } }),
    );

    expect(h.named('setMessageReaction')).toEqual([]);
    expect(h.texts()).toContain(TEXT.replyFailed);
  });

  it('does not report a delivered answer as failed when the reaction is refused', async () => {
    const h = harness();
    h.replies.setMessageReaction = () =>
      failure(400, 'Bad Request: REACTION_INVALID');

    await h.send(
      groupText('Вже їде', { reply_to_message: { ...toBot, text: tagged } }),
    );

    expect(h.texts()).not.toContain(TEXT.replyFailed);
  });
});

describe('MerchChatService admin panel', () => {
  const withPrompt = (h: Harness, prompt: string) =>
    h.db.customers.set(7n, {
      prompt,
      promptUntil: new Date(Date.now() + HOUR),
    });

  it('shows the panel to a shop admin and drops the prompt', async () => {
    const h = harness();
    withPrompt(h, 'mono');

    await h.send(command('/admin'));

    const [panel] = h.named('sendMessage');
    expect(panel.text).toBe(TEXT.panel);
    expect(keyboardOf(panel)[0]).toEqual([
      { text: '📦 Управління товарами', web_app: { url: `${APP}/admin` } },
    ]);
    expect(h.db.customers.get(7n)!.prompt).toBeNull();
  });

  it('refuses a stranger', async () => {
    const h = harness();
    h.merchBot.isShopAdmin.mockResolvedValue(false);

    await h.send(command('/admin'));
    await h.send(command('/clear_orders'));
    await h.send(click('admin:set_mono'));
    await h.send(click('bc:no'));
    await h.send(click('co:no'));

    expect(h.texts()).toEqual([TEXT.panelDenied, TEXT.commandDenied]);
    expect(h.named('answerCallbackQuery')).toHaveLength(3);
    for (const alert of h.named('answerCallbackQuery')) {
      expect(alert).toMatchObject({ text: TEXT.panelDenied, show_alert: true });
    }
    expect(h.named('editMessageText')).toEqual([]);
    expect(h.db.customers.size).toBe(0);
  });

  it.each([
    ['set_mono', 'mono', TEXT.monoPrompt],
    ['set_card', 'card', TEXT.cardPrompt],
    ['set_welcome', 'welcome', TEXT.welcomePrompt],
    ['broadcast', 'broadcast', TEXT.broadcastPrompt],
  ])(
    'opens the %s prompt with a cancel button',
    async (action, prompt, ask) => {
      const h = harness();
      const now = Date.now();

      await h.send(click(`admin:${action}`));

      const row = h.db.customers.get(7n)!;
      expect(row.prompt).toBe(prompt);
      const until = row.promptUntil!.getTime();
      expect(until).toBeGreaterThanOrEqual(now + HOUR / 2);
      expect(until).toBeLessThan(now + HOUR);
      const [edit] = h.named('editMessageText');
      expect(edit.text).toBe(ask);
      expect(keyboardOf(edit)).toEqual([
        [{ text: 'Скасувати', callback_data: 'admin:cancel' }],
      ]);
      expect(h.named('answerCallbackQuery')).toHaveLength(1);
    },
  );

  it('goes back to the panel on cancel', async () => {
    const h = harness();
    withPrompt(h, 'card');

    await h.send(click('admin:cancel'));

    expect(h.db.customers.get(7n)!.prompt).toBeNull();
    expect(h.named('editMessageText')[0].text).toBe(TEXT.panel);
  });

  it('flips DayF and redraws the keyboard', async () => {
    const h = harness();

    await h.send(click('admin:dayf'));

    expect(h.shop.dayfEnabled).toBe(true);
    const buttons = keyboardOf(h.named('editMessageReplyMarkup')[0]).flat();
    expect(buttons.map((b) => b.text)).toContain('🚚 DayF: увімкнено');
  });

  it('answers an unknown admin button', async () => {
    const h = harness();

    await h.send(click('admin:main'));

    expect(h.named('answerCallbackQuery')).toHaveLength(1);
    expect(h.named('editMessageText')).toEqual([]);
  });

  it('survives a restart: a fresh service consumes the prompt from the row', async () => {
    const first = harness();
    await first.send(click('admin:set_mono'));

    const second = harness({ db: first.db });
    await second.send(text('https://send.monobank.ua/jar/abc'));

    expect(second.shop.monoJarUrl).toBe('https://send.monobank.ua/jar/abc');
    expect(second.texts()).toEqual([TEXT.monoDone]);
    expect(first.db.customers.get(7n)!.prompt).toBeNull();
  });

  it.each([
    ['mono', 'http://plain', TEXT.monoInvalid],
    ['mono', `https://${'a'.repeat(250)}`, TEXT.monoInvalid],
    ['card', '4444-1111', TEXT.cardInvalid],
    ['card', '1'.repeat(21), TEXT.cardInvalid],
    ['welcome', 'я'.repeat(4001), TEXT.textRequired],
  ])('keeps the %s prompt on wrong input', async (prompt, value, error) => {
    const h = harness();
    withPrompt(h, prompt);

    await h.send(text(value));

    expect(h.texts()).toEqual([error]);
    expect(h.merchBot.updateShopConfig).not.toHaveBeenCalled();
    expect(h.db.customers.get(7n)!.prompt).toBe(prompt);
  });

  it('saves a card with spaces, and 0 removes it', async () => {
    const h = harness();
    withPrompt(h, 'card');
    await h.send(text('4444 1111 2222 3333'));
    expect(h.shop.cardNumber).toBe('4444 1111 2222 3333');

    withPrompt(h, 'card');
    await h.send(text('0'));
    expect(h.shop.cardNumber).toBeNull();
    expect(h.texts()).toEqual([TEXT.cardDone, TEXT.cardDone]);
  });

  it('saves the welcome text trimmed and shows the panel with it', async () => {
    const h = harness();
    withPrompt(h, 'welcome');

    await h.send(text('  Привіт!  '));

    expect(h.shop.welcomeText).toBe('Привіт!');
    const [done] = h.named('sendMessage');
    expect(done.text).toBe(TEXT.welcomeDone);
    expect(keyboardOf(done)[1]).toEqual([
      { text: '💰 Банка Monobank', callback_data: 'admin:set_mono' },
    ]);
  });

  it('keeps a text prompt on a photo', async () => {
    const h = harness();
    withPrompt(h, 'mono');

    await h.send(
      message({ photo: [{ file_id: 'p' }], caption: 'https://a.b' }),
    );

    expect(h.texts()).toEqual([TEXT.textRequired]);
    expect(h.db.customers.get(7n)!.prompt).toBe('mono');
    expect(h.merchBot.updateShopConfig).not.toHaveBeenCalled();
  });

  it('clears the prompt of someone who lost admin rights', async () => {
    const h = harness();
    withPrompt(h, 'broadcast');
    h.merchBot.isShopAdmin.mockResolvedValue(false);

    await h.send(text('усім привіт'));

    expect(h.texts()).toEqual([TEXT.panelDenied]);
    expect(h.named('copyMessage')).toEqual([]);
    expect(h.db.customers.get(7n)!.prompt).toBeNull();
  });

  it('never broadcasts a command: /support replaces the prompt', async () => {
    const h = harness();
    withPrompt(h, 'broadcast');

    await h.send(command('/support'));

    expect(h.named('copyMessage')).toEqual([]);
    expect(h.db.customers.get(7n)!.prompt).toBe('support');
  });

  it('drops the prompt on any other command', async () => {
    const h = harness();
    withPrompt(h, 'broadcast');

    await h.send(command('/unknown'));

    expect(h.calls).toEqual([]);
    expect(h.db.customers.get(7n)!.prompt).toBeNull();
  });
});

describe('MerchChatService broadcast', () => {
  const confirm = (data: string) =>
    click(data, {
      message: {
        message_id: 60,
        date: 0,
        chat: PRIVATE,
        from: ME,
        text: 'Надіслати це повідомлення отримувачам: 2?',
      },
    });
  const preparing = (h: Harness) =>
    h.db.customers.set(7n, {
      prompt: 'broadcast',
      promptUntil: new Date(Date.now() + HOUR),
    });

  it('previews a copy and asks, with all state in the button', async () => {
    const h = harness();
    preparing(h);
    const update = text('Новий мерч!');
    const id = update.message.message_id;

    await h.send(update);

    expect(h.db.customers.get(7n)!.prompt).toBeNull();
    expect(h.named('copyMessage')[0]).toMatchObject({
      chat_id: USER.id,
      from_chat_id: USER.id,
      message_id: id,
    });
    const [ask] = h.named('sendMessage');
    expect(ask.text).toBe('Надіслати це повідомлення отримувачам: 2?');
    const [yes, no] = keyboardOf(ask)[0];
    expect(yes.text).toBe('✅ Надіслати');
    expect(yes.callback_data).toMatch(new RegExp(`^bc:go:${id}:\\d+$`));
    expect(no).toEqual({ text: 'Скасувати', callback_data: 'bc:no' });
  });

  it('counts only people with a live order who did not block the bot', async () => {
    const h = harness();
    preparing(h);

    await h.send(text('Новий мерч!'));

    expect(h.db.merchCustomer.count).toHaveBeenCalledWith({
      where: {
        blockedBot: false,
        orders: { some: { status: { not: 'CANCELLED' } } },
      },
    });
  });

  it('stops early on a message that cannot be copied', async () => {
    const h = harness();
    preparing(h);
    h.replies.copyMessage = () =>
      failure(400, "Bad Request: message can't be copied");

    await h.send(message({ dice: { emoji: '🎲', value: 3 } }));

    expect(h.texts()).toEqual([TEXT.broadcastUncopyable]);
    expect(h.db.merchCustomer.count).not.toHaveBeenCalled();
  });

  it('copies to everyone, then reports with the panel', async () => {
    const h = harness();

    await h.send(confirm(`bc:go:555:${unix()}`));
    await broadcastDone(h.service);

    expect(h.named('editMessageReplyMarkup')).toHaveLength(1);
    expect(h.texts()[0]).toBe(
      '📢 Розсилку запущено — отримувачів: 2. Звіт надійде після завершення.',
    );
    expect(h.named('copyMessage')).toEqual([
      { chat_id: 11, from_chat_id: USER.id, message_id: 555 },
      { chat_id: 12, from_chat_id: USER.id, message_id: 555 },
    ]);
    const report = h.named('sendMessage')[1];
    expect(report.text).toBe(
      '📢 Розсилку завершено!\n✅ Надіслано: 2\n❌ Не вдалося: 0',
    );
    expect(keyboardOf(report)[0][0].text).toBe('📦 Управління товарами');
  });

  it('does nothing on an expired confirm', async () => {
    const h = harness();

    await h.send(confirm(`bc:go:555:${unix(301_000)}`));

    expect(h.named('editMessageReplyMarkup')).toHaveLength(1);
    expect(h.named('editMessageText')[0].text).toBe(TEXT.broadcastExpired);
    expect(h.named('copyMessage')).toEqual([]);
    expect(h.db.merchCustomer.findMany).not.toHaveBeenCalled();
  });

  it('edits to the cancelled text on no', async () => {
    const h = harness();

    await h.send(confirm('bc:no'));

    expect(h.named('editMessageText')[0].text).toBe(TEXT.cancelled);
    expect(h.named('copyMessage')).toEqual([]);
  });

  it('waits out a 429 and tries again', async () => {
    const h = harness();
    const once = jest
      .fn<unknown, []>()
      .mockReturnValueOnce(
        failure(429, 'Too Many Requests', { retry_after: 0 }),
      );
    h.replies.copyMessage = () => once();

    await h.send(confirm(`bc:go:555:${unix()}`));
    await broadcastDone(h.service);

    expect(h.named('copyMessage')).toHaveLength(3);
    expect(h.named('sendMessage')[1].text).toContain('✅ Надіслано: 2');
  });

  it('gives up after four 429s', async () => {
    const h = harness({ db: fakeDb([{ telegramId: 11n }]) });
    h.replies.copyMessage = () =>
      failure(429, 'Too Many Requests', { retry_after: 0 });

    await h.send(confirm(`bc:go:555:${unix()}`));
    await broadcastDone(h.service);

    expect(h.named('copyMessage')).toHaveLength(4);
    expect(h.named('sendMessage')[1].text).toContain('❌ Не вдалося: 1');
  });

  it('marks a 403 as blocked and counts it', async () => {
    const h = harness();
    h.db.customers.set(11n, { blockedBot: false, prompt: null });
    h.replies.copyMessage = (p) =>
      p.chat_id === 11 ? failure(403, 'Forbidden: bot was blocked') : undefined;

    await h.send(confirm(`bc:go:555:${unix()}`));
    await broadcastDone(h.service);

    expect(h.db.customers.get(11n)!.blockedBot).toBe(true);
    expect(h.named('sendMessage')[1].text).toBe(
      '📢 Розсилку завершено!\n✅ Надіслано: 1\n❌ Не вдалося: 1',
    );
  });

  it('refuses a second start during the audience read', async () => {
    const h = harness();
    let release: (rows: Audience) => void = () => {};
    h.db.merchCustomer.findMany.mockImplementationOnce(
      () => new Promise<Audience>((done) => (release = done)),
    );

    await h.send(confirm(`bc:go:555:${unix()}`));
    await h.send(confirm(`bc:go:556:${unix()}`));

    expect(h.db.merchCustomer.findMany).toHaveBeenCalledTimes(1);
    expect(h.named('editMessageText')[0].text).toBe(TEXT.broadcastRunning);

    release([{ telegramId: 11n }]);
    await broadcastDone(h.service);
    expect(h.named('copyMessage')).toHaveLength(1);
  });

  it('allows another broadcast once the last one is done', async () => {
    const h = harness();

    await h.send(confirm(`bc:go:555:${unix()}`));
    await broadcastDone(h.service);
    await h.send(confirm(`bc:go:556:${unix()}`));
    await broadcastDone(h.service);

    expect(h.named('copyMessage')).toHaveLength(4);
  });

  it('waits for the stop report on shutdown', async () => {
    const h = harness();
    let release = () => {};
    h.replies.copyMessage = () => new Promise<void>((done) => (release = done));

    await h.send(confirm(`bc:go:555:${unix()}`));
    await until(() => h.named('copyMessage').length === 1);
    const down = h.service.onModuleDestroy();
    release();
    await down;

    expect(h.named('copyMessage')).toHaveLength(1);
    expect(h.texts()).toContain(
      '⚠️ Розсилку перервано перезапуском. Надіслано 1 з 2.',
    );
  });
});

describe('MerchChatService /clear_orders', () => {
  it('asks first with the count and a stamped button', async () => {
    const h = harness();

    await h.send(command('/clear_orders'));

    const [ask] = h.named('sendMessage');
    expect(ask.text).toBe(
      'Видалити всі замовлення (3) з бази і таблиці? Скасувати це неможливо.',
    );
    const [yes, no] = keyboardOf(ask)[0];
    expect(yes.text).toBe('🗑 Так, видалити');
    expect(yes.callback_data).toMatch(/^co:go:\d+$/);
    expect(no).toEqual({ text: 'Скасувати', callback_data: 'co:no' });
    expect(h.db.merchOrder.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes on a fresh confirm, buttons gone first', async () => {
    const h = harness();

    await h.send(click(`co:go:${unix()}`));

    const order = h.calls.map((c) => c.method);
    expect(order.indexOf('editMessageReplyMarkup')).toBeLessThan(
      order.indexOf('editMessageText'),
    );
    expect(h.db.merchOrder.deleteMany).toHaveBeenCalledTimes(1);
    expect(h.named('editMessageText')[0].text).toBe(TEXT.clearDone);
  });

  it('does nothing on an expired confirm', async () => {
    const h = harness();

    await h.send(click(`co:go:${unix(121_000)}`));

    expect(h.db.merchOrder.deleteMany).not.toHaveBeenCalled();
    expect(h.named('editMessageText')[0].text).toBe(TEXT.clearExpired);
  });

  it('runs once for two quick taps: the second finds no buttons', async () => {
    const h = harness();
    const edits = jest
      .fn<unknown, []>()
      .mockReturnValueOnce(undefined)
      .mockReturnValue(failure(400, 'Bad Request: message is not modified'));
    h.replies.editMessageReplyMarkup = () => edits();

    await h.send(click(`co:go:${unix()}`));
    await h.send(click(`co:go:${unix()}`));

    expect(h.db.merchOrder.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('keeps everything on no', async () => {
    const h = harness();

    await h.send(click('co:no'));

    expect(h.db.merchOrder.deleteMany).not.toHaveBeenCalled();
    expect(h.named('editMessageText')[0].text).toBe(TEXT.cancelled);
  });
});

describe('MerchChatService admin chat setup', () => {
  it('refuses /bind_admin_chat with an empty owner list', async () => {
    const h = harness({ env: {} });

    await h.send(groupCommand('/bind_admin_chat'));

    expect(h.texts()).toEqual([TEXT.bindDenied]);
    expect(h.merchBot.updateShopConfig).not.toHaveBeenCalled();
  });

  it('refuses someone who is not on the list', async () => {
    const h = harness({ env: { MERCH_OWNER_IDS: '5,6' } });

    await h.send(groupCommand('/bind_admin_chat'));

    expect(h.texts()).toEqual([TEXT.bindDenied]);
  });

  it('stays silent for an owner who is not an admin of the chat', async () => {
    const h = harness();
    h.replies.getChatMember = () => ({ status: 'member', user: ADMIN });

    await h.send(groupCommand('/bind_admin_chat'));

    expect(h.texts()).toEqual([]);
    expect(h.merchBot.updateShopConfig).not.toHaveBeenCalled();
  });

  it('binds a new chat, drops its thread ids, lets waiting cards go', async () => {
    const h = harness({
      shop: {
        adminChatId: BigInt(-100999),
        ordersThreadId: 633,
        supportThreadId: 629,
      },
    });

    await h.send(groupCommand('/bind_admin_chat'));

    expect(h.named('getChatMember')[0]).toMatchObject({
      chat_id: CHAT,
      user_id: ADMIN.id,
    });
    expect(h.shop).toMatchObject({
      adminChatId: BigInt(CHAT),
      adminChatTitle: GROUP.title,
      ordersThreadId: null,
      supportThreadId: null,
    });
    expect(h.sync.resendOpenCards).toHaveBeenCalledTimes(1);
    expect(h.merchBot.clearAdminCache).toHaveBeenCalled();
    expect(h.merchBot.kick).toHaveBeenCalled();
    expect(h.texts()).toEqual([TEXT.bindDone]);
  });

  it('keeps the threads when the same chat binds again', async () => {
    const h = harness({ shop: { ordersThreadId: 633 } });

    await h.send(groupCommand('/bind_admin_chat'));

    expect(h.shop.ordersThreadId).toBe(633);
  });

  it('does nothing with /bind_admin_chat in private', async () => {
    const h = harness();

    await h.send(command('/bind_admin_chat', { from: ADMIN }));

    expect(h.merchBot.updateShopConfig).not.toHaveBeenCalled();
    expect(h.texts()).toEqual([]);
  });

  it('sets threads, and 0 clears one', async () => {
    const h = harness({ shop: { supportThreadId: 629 } });

    await h.send(groupCommand('/setthreads orders:633 support:0'));

    expect(h.shop.ordersThreadId).toBe(633);
    expect(h.shop.supportThreadId).toBeNull();
    expect(h.texts()).toEqual([
      '✅ Теми налаштовано: замовлення → тема #633, підтримка → без теми',
    ]);
  });

  it('leaves the thread that was not named', async () => {
    const h = harness({ shop: { supportThreadId: 629 } });

    await h.send(groupCommand('/setthreads orders:633'));

    expect(h.shop.supportThreadId).toBe(629);
    expect(h.texts()).toEqual(['✅ Теми налаштовано: замовлення → тема #633']);
  });

  it('shows the usage on bad arguments', async () => {
    const h = harness();

    await h.send(groupCommand('/setthreads orders:abc'));

    expect(h.texts()).toEqual([TEXT.threadsUsage]);
  });

  it('asks to bind first in another chat', async () => {
    const h = harness({ shop: { adminChatId: BigInt(-100999) } });

    await h.send(groupCommand('/setthreads orders:633'));

    expect(h.texts()).toEqual([TEXT.threadsNotBound]);
    expect(h.merchBot.updateShopConfig).not.toHaveBeenCalled();
  });

  it('stays silent on /setthreads from a non-admin', async () => {
    const h = harness();
    h.replies.getChatMember = () => ({ status: 'member', user: ADMIN });

    await h.send(groupCommand('/setthreads orders:633'));

    expect(h.texts()).toEqual([]);
    expect(h.merchBot.updateShopConfig).not.toHaveBeenCalled();
  });

  it('follows a migration of the bound chat only', async () => {
    const h = harness();
    const migrated = () =>
      message({
        chat: { ...GROUP, id: -5, type: 'group' },
        from: ADMIN,
        migrate_to_chat_id: -100777,
      });

    await h.send(migrated());
    expect(h.merchBot.updateShopConfig).not.toHaveBeenCalled();
    expect(h.sync.resendOpenCards).not.toHaveBeenCalled();

    h.shop.adminChatId = BigInt(-5);
    await h.send(migrated());
    expect(h.shop.adminChatId).toBe(BigInt(-100777));
    expect(h.sync.resendOpenCards).toHaveBeenCalledTimes(1);
    expect(h.merchBot.clearAdminCache).toHaveBeenCalled();
    expect(h.merchBot.kick).toHaveBeenCalled();
  });
});

describe('MerchChatService my_chat_member', () => {
  const change = (status: string, chat: object = PRIVATE) => ({
    my_chat_member: {
      chat,
      from: USER,
      date: 0,
      old_chat_member: { status: 'member', user: ME },
      new_chat_member: { status, user: ME },
    },
  });

  it('tracks a block and an unblock', async () => {
    const h = harness();
    h.db.customers.set(7n, { blockedBot: false });

    await h.send(change('kicked'));
    expect(h.db.customers.get(7n)!.blockedBot).toBe(true);

    await h.send(change('member'));
    expect(h.db.customers.get(7n)!.blockedBot).toBe(false);
  });

  it('creates no row for a stranger and ignores groups', async () => {
    const h = harness();

    await h.send(change('kicked'));
    await h.send(change('kicked', GROUP));

    expect(h.db.customers.size).toBe(0);
    expect(h.db.merchCustomer.updateMany).toHaveBeenCalledTimes(1);
  });
});
