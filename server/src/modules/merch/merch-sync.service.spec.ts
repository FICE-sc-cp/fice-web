import type { MerchDeliveryMethod, MerchOrderStatus } from '@prisma/client';
import { existsSync } from 'fs';
import { GrammyError, InputFile } from 'grammy';
import type { InlineKeyboardMarkup } from 'grammy/types';
import { MerchSyncService } from './merch-sync.service';
import { statusKeyboard } from './merch-texts';

jest.mock('fs', () => ({
  ...jest.requireActual<object>('fs'),
  existsSync: jest.fn(() => true),
}));

const CHAT = -100123;
const CUSTOMER = 7;
const SITE = 'https://shop.test';
const RECEIPT = '/uploads/0e352379-dbd8-407f-98a5-38d60ab53528.jpg';

const money = (value: string) => ({ toFixed: () => value });

const tgError = (code: number, description: string, parameters = {}) =>
  new GrammyError(
    'Call failed!',
    { ok: false, error_code: code, description, parameters },
    'sendMessage',
    {},
  );
const RATE = tgError(429, 'Too Many Requests', { retry_after: 30 });
const BAD_THREAD = tgError(400, 'Bad Request: message thread not found');
const NETWORK = new Error('socket hang up');

const item = (title = 'Футболка') => ({
  title,
  size: 'M',
  color: 'Білий',
  quantity: 1,
  unitPrice: money('500.00'),
});

const blank = (id: number) => ({
  id,
  telegramId: BigInt(CUSTOMER),
  status: 'PENDING' as MerchOrderStatus,
  recipientName: 'Тарас Шевченко' as string | null,
  phone: '+380991234567',
  deliveryMethod: 'NOVA_POSHTA' as MerchDeliveryMethod | null,
  address: 'Київ, відділення 1',
  totalAmount: money('500.00'),
  currency: 'UAH',
  warnings: [] as string[],
  processedByAdmin: null as string | null,
  statusBy: null as string | null,
  customer: { blockedBot: false },
  items: [item()],
  receiptUrl: null as string | null,
  receiptFileId: null as string | null,
  adminMessageId: null as number | null,
  pickupSlot: null as {
    date: Date;
    startTime: string;
    endTime: string;
  } | null,
  needsIndividualPickup: false,
  cardDirty: true,
  notifyDirty: false,
  pickupDirty: false,
});
type Order = ReturnType<typeof blank>;

/** New orders come flagged; `over` resets what a case needs. */
const order = (id: number, over: Partial<Order> = {}): Order => ({
  ...blank(id),
  ...over,
});

interface Line {
  orderId: number;
  variantId: number | null;
  stockTaken: number;
}

interface Query {
  where: {
    id?: number;
    status?: MerchOrderStatus | { in: MerchOrderStatus[] };
    telegramId?: bigint;
    adminMessageId?: number | null | { not: null };
    cardDirty?: boolean;
    notifyDirty?: boolean;
    pickupDirty?: boolean;
  };
  take?: number;
  data?: Partial<Order>;
}

function matches(
  row: Order,
  { id, status, adminMessageId, ...flags }: Query['where'],
) {
  const sameCard =
    adminMessageId === undefined ||
    (adminMessageId && typeof adminMessageId === 'object'
      ? row.adminMessageId !== null
      : row.adminMessageId === adminMessageId);
  const sameStatus =
    !status ||
    (typeof status === 'string'
      ? row.status === status
      : status.in.includes(row.status));
  return (
    sameCard &&
    sameStatus &&
    (id === undefined || row.id === id) &&
    Object.entries(flags).every(([key, on]) => row[key as keyof Order] === on)
  );
}

interface Options {
  caption?: string;
  reply_markup?: InlineKeyboardMarkup;
  message_thread_id?: number;
  reply_parameters?: {
    message_id: number;
    allow_sending_without_reply?: boolean;
  };
}
type Sent = Promise<{ message_id: number }>;

function build(
  rows: Order[] = [],
  shopOver = {},
  enabled = true,
  polling = 'running',
) {
  const shop: Record<string, unknown> = {
    adminChatId: BigInt(CHAT),
    ordersThreadId: null,
    ...shopOver,
  };
  const merchOrder = {
    findMany: jest.fn(({ where, take }: Query) =>
      Promise.resolve(
        rows
          .filter((r) => matches(r, where))
          .slice(0, take)
          .map((r) => ({ ...r })),
      ),
    ),
    findUnique: jest.fn(({ where }: Query) =>
      Promise.resolve(rows.find((r) => r.id === where.id) ?? null),
    ),
    update: jest.fn(({ where, data }: Query) =>
      Promise.resolve(
        Object.assign(rows.find((r) => r.id === where.id)!, data),
      ),
    ),
    updateMany: jest.fn(({ where, data }: Query) => {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return Promise.resolve({ count: hit.length });
    }),
  };
  const lines: Line[] = [];
  const prisma = {
    merchOrder,
    merchOrderItem: {
      findMany: jest.fn(({ where }: { where: Partial<Line> }) =>
        Promise.resolve(
          lines
            .filter(
              (l) =>
                l.orderId === where.orderId &&
                l.stockTaken > 0 &&
                l.variantId !== null,
            )
            .sort((a, b) => a.variantId! - b.variantId!),
        ),
      ),
    },
    merchCustomer: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    $executeRaw: jest.fn<
      Promise<number>,
      [TemplateStringsArray, number, number]
    >(() => Promise.resolve(1)),
    $transaction: (fn: unknown): unknown =>
      typeof fn === 'function'
        ? (fn as (tx: unknown) => unknown)(prisma)
        : Promise.all(fn as unknown[]),
  };

  let messageId = 500;
  const sent = (): Sent => Promise.resolve({ message_id: ++messageId });
  const api = {
    sendPhoto: jest.fn<Sent, [number, string | InputFile, Options]>(sent),
    sendMessage: jest.fn<Sent, [number, string, Options?]>(sent),
    editMessageCaption: jest
      .fn<Promise<boolean>, [number, number, Options]>()
      .mockResolvedValue(true),
    editMessageText: jest
      .fn<Promise<boolean>, [number, number, string, Options]>()
      .mockResolvedValue(true),
  };
  const bot = {
    enabled,
    telegram: { api },
    shopConfig: jest.fn(() => Promise.resolve(shop)),
    updateShopConfig: jest.fn((data: object) =>
      Promise.resolve(Object.assign(shop, data)),
    ),
    clearAdminCache: jest.fn(),
    kick: jest.fn(),
    pollingStatus: () => polling,
    setKick: jest.fn<void, [() => void]>(),
    appUrl: (path = ''): string | undefined => `${SITE}/merch-app${path}`,
  };
  const config = {
    get: (key: string) => (key === 'PUBLIC_WEB_URL' ? `${SITE}/` : undefined),
  };
  const service = new MerchSyncService(
    prisma as never,
    bot as never,
    config as never,
  );
  /** One drain plus the passes it queued. Gives the number of passes. */
  const run = async () => {
    const drain = jest.spyOn(service, 'drain');
    drain.mockClear();
    await service.drain();
    for (let pass = 0; pass < drain.mock.results.length; pass++) {
      await (drain.mock.results[pass].value as Promise<void>);
      await new Promise((done) => setImmediate(done));
    }
    return drain.mock.calls.length;
  };
  return { service, prisma, merchOrder, api, bot, shop, lines, run };
}

afterEach(() => {
  jest.restoreAllMocks();
  (existsSync as jest.Mock).mockReturnValue(true);
});

describe('MerchSyncService start', () => {
  it('stays off without a token', () => {
    const setTimer = jest.spyOn(global, 'setInterval');
    const { service, bot, merchOrder } = build([], {}, false);

    service.onModuleInit();

    expect(bot.setKick).not.toHaveBeenCalled();
    expect(setTimer).not.toHaveBeenCalled();
    expect(merchOrder.findMany).not.toHaveBeenCalled();
  });

  it('wires kick and a 15 s timer; the first drain waits for polling', () => {
    const handle = { unref: jest.fn() };
    const setTimer = jest
      .spyOn(global, 'setInterval')
      .mockReturnValue(handle as never);
    const clear = jest.spyOn(global, 'clearInterval');
    const { service, bot } = build();
    const drain = jest.spyOn(service, 'drain');

    service.onModuleInit();
    service.onModuleDestroy();

    expect(bot.setKick).toHaveBeenCalledTimes(1);
    expect(setTimer).toHaveBeenCalledWith(expect.any(Function), 15_000);
    expect(handle.unref).toHaveBeenCalled();
    expect(clear).toHaveBeenCalledWith(handle);
    expect(drain).not.toHaveBeenCalled();

    bot.setKick.mock.calls[0][0]();
    expect(drain).toHaveBeenCalledTimes(1);
  });
});

describe('MerchSyncService cards', () => {
  it('sends a card for a flagged order and never for an imported one', async () => {
    const fresh = order(1);
    const imported = order(2, {
      cardDirty: false,
      receiptFileId: 'old-file',
      adminMessageId: 44,
    });
    const { api, run } = build([fresh, imported]);

    await run();

    expect(api.sendMessage).toHaveBeenCalledTimes(1);
    const [chat, text, other] = api.sendMessage.mock.calls[0];
    expect(chat).toBe(CHAT);
    expect(text).toContain('🔔 Замовлення #1 [🕐 Очікує]');
    expect(other?.reply_markup).toEqual(statusKeyboard(1, 'PENDING'));
    expect(fresh.cardDirty).toBe(false);
    expect(fresh.adminMessageId).toBe(501);
    expect(api.sendPhoto).not.toHaveBeenCalled();
    expect(api.editMessageCaption).not.toHaveBeenCalled();
  });

  it('sends the uploaded receipt as a file with the card as caption', async () => {
    const row = order(1, { receiptUrl: RECEIPT });
    const { api, run } = build([row]);

    await run();

    const [chat, file, other] = api.sendPhoto.mock.calls[0];
    expect(chat).toBe(CHAT);
    expect(file).toBeInstanceOf(InputFile);
    expect(other.caption).toContain('Замовлення #1');
    expect(other.reply_markup).toEqual(statusKeyboard(1, 'PENDING'));
    expect(row.cardDirty).toBe(false);
  });

  it('sends the Telegram file id of an old order', async () => {
    const row = order(1, { receiptFileId: 'old-file' });
    const { api, run } = build([row]);

    await run();

    expect(api.sendPhoto.mock.calls[0][1]).toBe('old-file');
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('holds cards while no chat is bound, then sends them', async () => {
    const row = order(1);
    const { api, shop, run } = build([row], { adminChatId: null });

    await run();
    expect(api.sendMessage).not.toHaveBeenCalled();
    expect(row.cardDirty).toBe(true);

    shop.adminChatId = BigInt(CHAT);
    await run();
    expect(api.sendMessage).toHaveBeenCalledTimes(1);
    expect(row.cardDirty).toBe(false);
  });

  it('keeps a failed card dirty and sends it next pass, the rest meanwhile', async () => {
    const first = order(1);
    const second = order(2);
    const { api, run } = build([first, second]);
    api.sendMessage.mockRejectedValueOnce(NETWORK);

    await run();
    expect(first.cardDirty).toBe(true);
    expect(first.adminMessageId).toBeNull();
    expect(second.cardDirty).toBe(false);

    await run();
    expect(first.cardDirty).toBe(false);
    expect(first.adminMessageId).not.toBeNull();
    expect(api.sendMessage).toHaveBeenCalledTimes(3);
  });

  it('makes one pass for a batch that fails whole', async () => {
    const rows = Array.from({ length: 25 }, (_, i) => order(i + 1));
    const { api, run } = build(rows);
    api.sendMessage.mockRejectedValue(NETWORK);

    expect(await run()).toBe(1);
    expect(api.sendMessage).toHaveBeenCalledTimes(20);
    expect(rows.every((r) => r.cardDirty)).toBe(true);
  });

  it('goes on at once after a full batch that cleared something', async () => {
    const rows = Array.from({ length: 25 }, (_, i) => order(i + 1));
    const { api, run } = build(rows);

    expect(await run()).toBe(2);
    expect(api.sendMessage).toHaveBeenCalledTimes(25);
  });

  it('pauses the whole loop on a 429 and loses nothing', async () => {
    const first = order(1);
    const second = order(2);
    const { api, merchOrder, run } = build([first, second]);
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    api.sendMessage.mockRejectedValueOnce(RATE);

    await run();
    expect(api.sendMessage).toHaveBeenCalledTimes(1);
    expect(first.cardDirty).toBe(true);
    expect(second.cardDirty).toBe(true);

    merchOrder.findMany.mockClear();
    now.mockReturnValue(1_000_000 + 29_999);
    await run();
    expect(merchOrder.findMany).not.toHaveBeenCalled();

    now.mockReturnValue(1_000_000 + 30_000);
    await run();
    expect(first.cardDirty).toBe(false);
    expect(second.cardDirty).toBe(false);
  });

  it('falls back to General on a bad thread', async () => {
    const row = order(1, { receiptFileId: 'old-file' });
    const { api, run } = build([row], { ordersThreadId: 633 });
    api.sendPhoto.mockRejectedValueOnce(BAD_THREAD);

    await run();

    expect(api.sendPhoto).toHaveBeenCalledTimes(2);
    expect(api.sendPhoto.mock.calls[0][2].message_thread_id).toBe(633);
    expect(api.sendPhoto.mock.calls[1][2].message_thread_id).toBeUndefined();
    expect(row.cardDirty).toBe(false);
  });

  it.each([
    ['media', tgError(400, 'Bad Request: PHOTO_INVALID_DIMENSIONS')],
    ['a wrong file id', tgError(400, 'Bad Request: wrong file identifier')],
    ['any other 400', tgError(400, 'Bad Request: something else')],
  ])('gives a text card and clears the flag on %s', async (_name, err) => {
    const row = order(1, { receiptUrl: RECEIPT });
    const { api, run } = build([row]);
    api.sendPhoto.mockRejectedValueOnce(err);

    await run();

    const [, text] = api.sendMessage.mock.calls[0];
    expect(text).toContain('Замовлення #1');
    expect(text).toContain(
      `\n\n⚠️ Квитанцію не вдалося прикласти\n${SITE}${RECEIPT}`,
    );
    expect(row.cardDirty).toBe(false);
    expect(row.adminMessageId).toBe(501);
  });

  it('gives a text card when the file is gone from disk', async () => {
    (existsSync as jest.Mock).mockReturnValue(false);
    const row = order(1, { receiptUrl: RECEIPT });
    const { api, run } = build([row]);

    await run();

    expect(api.sendPhoto).not.toHaveBeenCalled();
    expect(api.sendMessage.mock.calls[0][1]).toContain(`${SITE}${RECEIPT}`);
    expect(row.cardDirty).toBe(false);
  });

  it('keeps the flag when the text card itself is refused', async () => {
    const row = order(1, { receiptUrl: RECEIPT });
    const { api, run } = build([row]);
    const gone = tgError(400, 'Bad Request: chat not found');
    api.sendPhoto.mockRejectedValueOnce(gone);
    api.sendMessage.mockRejectedValueOnce(gone);

    await run();

    expect(row.cardDirty).toBe(true);
    expect(row.adminMessageId).toBeNull();
  });

  it('keeps a text card with a receipt line inside the message limit', async () => {
    const items = Array.from({ length: 200 }, () => item('Т'.repeat(100)));
    const row = order(1, { receiptUrl: RECEIPT, items });
    (existsSync as jest.Mock).mockReturnValue(false);
    const { api, run } = build([row]);

    await run();

    const [, text] = api.sendMessage.mock.calls[0];
    expect(text.length).toBeLessThanOrEqual(4096);
    expect(text).toContain(RECEIPT);
  });

  it('rewrites the chat on a migration and sends there', async () => {
    const first = order(1);
    const second = order(2);
    const { api, bot, shop, run } = build([first, second]);
    api.sendMessage.mockRejectedValueOnce(
      tgError(400, 'Bad Request: group chat was upgraded', {
        migrate_to_chat_id: -100999,
      }),
    );

    expect(await run()).toBe(2);

    expect(bot.updateShopConfig).toHaveBeenCalledWith({
      adminChatId: BigInt(-100999),
    });
    expect(bot.clearAdminCache).toHaveBeenCalled();
    expect(shop.adminChatId).toBe(BigInt(-100999));
    expect(first.cardDirty).toBe(false);
    expect(api.sendMessage.mock.calls.at(-1)?.[0]).toBe(-100999);
  });

  it('never edits an old card in the chat a migration moved to', async () => {
    const stale = order(2, { adminMessageId: 555 });
    const { api, run } = build([order(1), stale]);
    api.sendMessage.mockRejectedValueOnce(
      tgError(400, 'Bad Request: group chat was upgraded', {
        migrate_to_chat_id: -100999,
      }),
    );

    await run();

    expect(api.editMessageCaption).not.toHaveBeenCalled();
    expect(stale.cardDirty).toBe(false);
    expect(stale.adminMessageId).not.toBe(555);
  });

  it('keeps the flag when the chat moved during an edit', async () => {
    const row = order(1, { adminMessageId: 555 });
    const { api, service, run } = build([row]);
    api.editMessageCaption.mockImplementationOnce(async () => {
      await service.resendOpenCards();
      return true;
    });

    await run();

    expect(row.adminMessageId).toBeNull();
    expect(row.cardDirty).toBe(true);
  });

  it('sends what the caption cannot hold as a reply to the card', async () => {
    const items = Array.from({ length: 60 }, (_, i) => item(`Товар ${i}`));
    const row = order(1, { receiptFileId: 'old-file', items });
    const { api, run } = build([row], { ordersThreadId: 633 });

    await run();

    expect(api.sendPhoto.mock.calls[0][2].caption!.length).toBeLessThanOrEqual(
      1024,
    );
    const [chat, overflow, other] = api.sendMessage.mock.calls[0];
    expect(chat).toBe(CHAT);
    expect(overflow).toContain('Товар 59');
    expect(other?.reply_parameters).toEqual({
      message_id: 501,
      allow_sending_without_reply: true,
    });
    expect(other?.message_thread_id).toBe(633);
  });

  it('sends no overflow when the text card holds everything', async () => {
    const items = Array.from({ length: 60 }, (_, i) => item(`Товар ${i}`));
    const { api, run } = build([order(1, { items })]);

    await run();

    expect(api.sendMessage).toHaveBeenCalledTimes(1);
    expect(api.sendMessage.mock.calls[0][1]).toContain('Товар 59');
  });

  it('keeps the card when its overflow fails', async () => {
    const items = Array.from({ length: 60 }, () => item());
    const row = order(1, { receiptFileId: 'old-file', items });
    const { api, run } = build([row]);
    api.sendMessage.mockRejectedValueOnce(NETWORK);

    await run();

    expect(row.adminMessageId).toBe(501);
    expect(row.cardDirty).toBe(false);
  });

  it('leaves a status change during a send dirty and edits it next pass', async () => {
    const row = order(1);
    const { api, run } = build([row]);
    api.sendMessage.mockImplementationOnce(() => {
      row.status = 'IN_PROCESS';
      row.statusBy = 'Леся Українка';
      return Promise.resolve({ message_id: 77 });
    });

    await run();
    expect(row.adminMessageId).toBe(77);
    expect(row.cardDirty).toBe(true);

    await run();
    expect(api.sendMessage).toHaveBeenCalledTimes(1);
    const [chat, messageId, other] = api.editMessageCaption.mock.calls[0];
    expect([chat, messageId]).toEqual([CHAT, 77]);
    expect(other.caption).toContain('[🔄 В роботі]');
    expect(other.caption).toContain('Взяв в роботу: Леся Українка');
    expect(other.reply_markup).toEqual(statusKeyboard(1, 'IN_PROCESS'));
    expect(row.cardDirty).toBe(false);
  });

  it('edits a text card as text and keeps the receipt link', async () => {
    const row = order(1, { adminMessageId: 77, receiptUrl: RECEIPT });
    const { api, run } = build([row]);
    api.editMessageCaption.mockRejectedValueOnce(
      tgError(400, 'Bad Request: there is no caption in the message to edit'),
    );

    await run();

    expect(api.editMessageText.mock.calls[0][2]).toContain(`${SITE}${RECEIPT}`);
    expect(row.cardDirty).toBe(false);
  });

  it.each([
    ['unchanged', 'Bad Request: message is not modified'],
    ['gone', 'Bad Request: message to edit not found'],
  ])('treats a %s edit as done', async (_name, description) => {
    const row = order(1, { adminMessageId: 77 });
    const { api, run } = build([row]);
    api.editMessageCaption.mockRejectedValueOnce(tgError(400, description));

    await run();

    expect(row.cardDirty).toBe(false);
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('keeps the flag on a failed edit and stops on a 429', async () => {
    const row = order(1, { adminMessageId: 77 });
    const next = order(2, { adminMessageId: 78 });
    const { api, run } = build([row, next]);
    api.editMessageCaption.mockRejectedValueOnce(NETWORK);
    await run();
    expect(row.cardDirty).toBe(true);
    expect(next.cardDirty).toBe(false);

    next.cardDirty = true;
    api.editMessageCaption.mockClear();
    api.editMessageCaption.mockRejectedValueOnce(RATE);
    await run();
    expect(api.editMessageCaption).toHaveBeenCalledTimes(1);
    expect(next.cardDirty).toBe(true);
  });
});

describe('MerchSyncService pickups', () => {
  const slot = {
    date: new Date('2026-11-12T00:00:00.000Z'),
    startTime: '12:00',
    endTime: '14:00',
  };
  const picked = (over: Partial<Order> = {}) =>
    order(1, {
      status: 'READY_FOR_PICKUP',
      deliveryMethod: 'LATER_CAMPUS',
      cardDirty: false,
      pickupDirty: true,
      adminMessageId: 77,
      pickupSlot: slot,
      ...over,
    });

  it('tells the admins under the card, then the customer', async () => {
    const row = picked();
    const { api, run } = build([row], { ordersThreadId: 633 });

    await run();

    const [[chat, note, other], [customer, text]] = api.sendMessage.mock.calls;
    expect(chat).toBe(CHAT);
    expect(note).toContain('Слот: 2026-11-12 12:00-14:00');
    expect(other?.message_thread_id).toBe(633);
    expect(other?.reply_parameters).toEqual({
      message_id: 77,
      allow_sending_without_reply: true,
    });
    expect(customer).toBe(CUSTOMER);
    expect(text).toContain('📦 2026-11-12 12:00-14:00');
    expect(row.pickupDirty).toBe(false);
  });

  it('answers an individual pickup without replying to a missing card', async () => {
    const row = picked({
      pickupSlot: null,
      needsIndividualPickup: true,
      adminMessageId: null,
    });
    const { api, run } = build([row]);

    await run();

    const [[, , other], [, text]] = api.sendMessage.mock.calls;
    expect(other?.reply_parameters).toBeUndefined();
    expect(text).toContain('індивідуальну видачу');
  });

  it('treats a blocked customer as told and shows it on the card', async () => {
    const row = picked();
    const { api, prisma, run } = build([row]);
    api.sendMessage
      .mockResolvedValueOnce({ message_id: 90 })
      .mockRejectedValueOnce(tgError(403, 'Forbidden: bot was blocked'));

    await run();

    expect(prisma.merchCustomer.updateMany).toHaveBeenCalledWith({
      where: { telegramId: BigInt(CUSTOMER), blockedBot: false },
      data: { blockedBot: true },
    });
    expect(row.pickupDirty).toBe(false);
    expect(row.cardDirty).toBe(true);
  });

  it('keeps the flag on a network error', async () => {
    const row = picked();
    const { api, run } = build([row]);
    api.sendMessage
      .mockResolvedValueOnce({ message_id: 90 })
      .mockRejectedValueOnce(NETWORK);

    await run();

    expect(row.pickupDirty).toBe(true);
  });

  it('holds the customer message while the admin chat is unreachable', async () => {
    const row = picked();
    const { api, run } = build([row]);
    api.sendMessage.mockRejectedValueOnce(NETWORK);

    await run();

    expect(api.sendMessage).toHaveBeenCalledTimes(1);
    expect(row.pickupDirty).toBe(true);
  });

  it('still answers the customer when the admin chat refuses with a 400', async () => {
    const row = picked();
    const { api, run } = build([row]);
    api.sendMessage.mockRejectedValueOnce(
      tgError(400, 'Bad Request: chat not found'),
    );

    await run();

    expect(api.sendMessage.mock.calls.at(-1)?.[0]).toBe(CUSTOMER);
    expect(row.pickupDirty).toBe(false);
  });
});

describe('MerchSyncService notices', () => {
  const noticed = (over: Partial<Order> = {}) =>
    order(1, { cardDirty: false, notifyDirty: true, ...over });
  const ready = {
    status: 'READY_FOR_PICKUP',
    deliveryMethod: 'LATER_CAMPUS',
  } as const;

  it('tells a new customer the order arrived, even with no chat bound', async () => {
    const row = noticed();
    const { api, run } = build([row], { adminChatId: null });

    await run();

    expect(api.sendMessage).toHaveBeenCalledWith(
      CUSTOMER,
      '✅ Замовлення #1 прийнято. Ми перевіримо оплату та повідомимо вас тут.',
      undefined,
    );
    expect(row.notifyDirty).toBe(false);
  });

  it('sends the latest status and clears the flag', async () => {
    const row = noticed({ status: 'COMPLETED' });
    const { api, run } = build([row]);

    await run();

    expect(api.sendMessage.mock.calls[0][1]).toBe(
      '🔔 Статус замовлення #1 змінено!\n\n✅ Ваше замовлення виконано та відправлено!',
    );
    expect(row.notifyDirty).toBe(false);
  });

  it('adds the pickup button with a cache buster', async () => {
    const { api, run } = build([noticed(ready)]);
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    await run();

    expect(api.sendMessage.mock.calls[0][2]?.reply_markup).toEqual({
      inline_keyboard: [
        [
          {
            text: '🗓 Обрати час видачі',
            web_app: { url: `${SITE}/merch-app/pickup/1?_t=1700000000` },
          },
        ],
      ],
    });
  });

  it('sends the message without a button when there is no https URL', async () => {
    const row = noticed(ready);
    const { api, bot, run } = build([row]);
    bot.appUrl = () => undefined;

    await run();

    expect(api.sendMessage.mock.calls[0][2]).toBeUndefined();
    expect(row.notifyDirty).toBe(false);
  });

  it('keeps the flag on a network error', async () => {
    const row = noticed();
    const { api, run } = build([row]);
    api.sendMessage.mockRejectedValueOnce(NETWORK);

    await run();
    expect(row.notifyDirty).toBe(true);

    await run();
    expect(row.notifyDirty).toBe(false);
  });

  it('keeps the flag on a 5xx', async () => {
    const row = noticed();
    const { api, run } = build([row]);
    api.sendMessage.mockRejectedValueOnce(tgError(502, 'Bad Gateway'));

    await run();

    expect(row.notifyDirty).toBe(true);
  });

  it('gives up on a 400', async () => {
    const row = noticed();
    const { api, prisma, run } = build([row]);
    api.sendMessage.mockRejectedValueOnce(
      tgError(400, 'Bad Request: chat not found'),
    );

    await run();

    expect(row.notifyDirty).toBe(false);
    expect(row.cardDirty).toBe(false);
    expect(prisma.merchCustomer.updateMany).not.toHaveBeenCalled();
  });

  it('marks a 403 as blocked and dirties the card', async () => {
    const row = noticed();
    const { api, prisma, run } = build([row]);
    api.sendMessage.mockRejectedValueOnce(
      tgError(403, 'Forbidden: bot was blocked by the user'),
    );

    await run();

    expect(prisma.merchCustomer.updateMany).toHaveBeenCalledWith({
      where: { telegramId: BigInt(CUSTOMER), blockedBot: false },
      data: { blockedBot: true },
    });
    expect(row.notifyDirty).toBe(false);
    expect(row.cardDirty).toBe(true);
  });

  it('stops the pass on a 429 with the flag kept', async () => {
    const first = noticed();
    const second = order(2, { cardDirty: false, notifyDirty: true });
    const { api, run } = build([first, second]);
    api.sendMessage.mockRejectedValueOnce(RATE);

    await run();

    expect(api.sendMessage).toHaveBeenCalledTimes(1);
    expect(first.notifyDirty).toBe(true);
    expect(second.notifyDirty).toBe(true);
  });

  it('sends only the latest status after two quick clicks', async () => {
    const row = noticed({ status: 'IN_PROCESS' });
    const { api, run } = build([row]);
    api.sendMessage.mockImplementationOnce(() => {
      row.status = 'COMPLETED';
      return Promise.resolve({ message_id: 90 });
    });

    await run();
    expect(row.notifyDirty).toBe(true);

    await run();
    expect(api.sendMessage.mock.calls.at(-1)?.[1]).toContain('виконано');
    expect(row.notifyDirty).toBe(false);
  });
});

describe('MerchSyncService resendOpenCards', () => {
  it('gives open orders a new card and forgets every old id', async () => {
    const rows = [
      order(1, { status: 'PENDING', adminMessageId: 11, cardDirty: false }),
      order(2, { status: 'IN_PROCESS', adminMessageId: 12, cardDirty: false }),
      order(3, {
        status: 'READY_FOR_PICKUP',
        adminMessageId: 13,
        cardDirty: false,
      }),
      order(4, { status: 'COMPLETED', adminMessageId: 14, cardDirty: false }),
      order(5, { status: 'CANCELLED', adminMessageId: 15, cardDirty: false }),
    ];
    const { api, service, run } = build(rows);

    await service.resendOpenCards();
    await run();

    expect(api.sendMessage.mock.calls.map(([chat]) => chat)).toEqual([
      CHAT,
      CHAT,
      CHAT,
    ]);
    expect(api.editMessageCaption).not.toHaveBeenCalled();
    expect(rows.map((r) => r.cardDirty)).toEqual(Array(5).fill(false));
    expect(rows[3].adminMessageId).toBeNull();
    expect(rows[0].adminMessageId).toBeGreaterThan(500);
  });
});

describe('MerchSyncService setBlocked', () => {
  it('re-edits the open cards of a customer who came back', async () => {
    const open = order(1, { adminMessageId: 11, cardDirty: false });
    const closed = order(2, {
      status: 'COMPLETED',
      adminMessageId: 12,
      cardDirty: false,
    });
    const other = order(3, {
      telegramId: 99n,
      adminMessageId: 13,
      cardDirty: false,
    });
    const { bot, prisma, service } = build([open, closed, other]);

    await service.setBlocked(BigInt(CUSTOMER), false);

    expect(prisma.merchCustomer.updateMany).toHaveBeenCalledWith({
      where: { telegramId: BigInt(CUSTOMER), blockedBot: true },
      data: { blockedBot: false },
    });
    expect([open, closed, other].map((r) => r.cardDirty)).toEqual([
      true,
      false,
      false,
    ]);
    expect(bot.kick).toHaveBeenCalled();
  });

  it('touches no card when nothing changed', async () => {
    const row = order(1, { cardDirty: false });
    const { bot, prisma, service } = build([row]);
    prisma.merchCustomer.updateMany.mockResolvedValue({ count: 0 });

    await service.setBlocked(BigInt(CUSTOMER), false);

    expect(row.cardDirty).toBe(false);
    expect(bot.kick).not.toHaveBeenCalled();
  });
});

describe('MerchSyncService drain', () => {
  it('sends nothing while the boot guard has refused polling', async () => {
    const { api, merchOrder, service } = build(
      [order(1, { notifyDirty: true })],
      {},
      true,
      'disabled',
    );

    await service.drain();

    expect(merchOrder.findMany).not.toHaveBeenCalled();
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('turns a kick during a pass into one more pass', async () => {
    const row = order(1);
    const { service, api, merchOrder, run } = build([row]);
    api.sendMessage.mockImplementationOnce(() => {
      void service.drain();
      return Promise.resolve({ message_id: 90 });
    });

    expect(await run()).toBe(3); // the pass, the kick that found it busy, the repeat
    const cardReads = merchOrder.findMany.mock.calls.filter(
      ([query]) => query.where.cardDirty,
    );
    expect(cardReads).toHaveLength(2);
  });

  it('survives a database failure', async () => {
    const { service, merchOrder } = build([order(1)]);
    merchOrder.findMany.mockRejectedValueOnce(new Error('connection lost'));

    await expect(service.drain()).resolves.toBeUndefined();
  });
});

describe('MerchSyncService changeStatus', () => {
  const CANCELLED_LINES: Line[] = [
    { orderId: 1, variantId: 9, stockTaken: 2 },
    { orderId: 1, variantId: 3, stockTaken: 1 },
    { orderId: 1, variantId: null, stockTaken: 4 }, // variant deleted
    { orderId: 1, variantId: 5, stockTaken: 0 }, // nothing was taken
    { orderId: 2, variantId: 4, stockTaken: 8 },
  ];

  it('moves the order, flags card and notice, names the actor', async () => {
    const row = order(1, { cardDirty: false });
    const { service } = build([row]);

    const answer = await service.changeStatus(1, 'IN_PROCESS', 'Леся Українка');

    expect(answer).toEqual({ text: 'Статус змінено: 🔄 В роботі' });
    expect(row).toMatchObject({
      status: 'IN_PROCESS',
      statusBy: 'Леся Українка',
      processedByAdmin: 'Леся Українка',
      cardDirty: true,
      notifyDirty: true,
    });
  });

  it('keeps who took it in work through the next statuses', async () => {
    const row = order(1, {
      status: 'IN_PROCESS',
      processedByAdmin: 'Леся Українка',
    });
    const { service } = build([row]);

    await service.changeStatus(1, 'COMPLETED', 'Іван Франко');

    expect(row.processedByAdmin).toBe('Леся Українка');
    expect(row.statusBy).toBe('Іван Франко');
  });

  it('returns exactly what cancel owes, once, in variant order', async () => {
    const row = order(1);
    const { service, prisma, lines } = build([row]);
    lines.push(...CANCELLED_LINES);

    const [first, second] = await Promise.all([
      service.changeStatus(1, 'CANCELLED', 'Леся'),
      service.changeStatus(1, 'CANCELLED', 'Леся'),
    ]);

    expect(first.text).toBe('Статус змінено: ❌ Скасовано');
    expect(second.text).toBe('Цей статус вже встановлено');
    const raw = prisma.$executeRaw.mock.calls;
    expect(raw.map(([, taken, id]) => [id, taken])).toEqual([
      [3, 1],
      [9, 2],
    ]);
    expect(raw[0][0].join('?')).toContain('stock IS NOT NULL');
    expect(prisma.merchOrderItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { variantId: 'asc' } }),
    );
  });

  it('touches no stock on any other status', async () => {
    const { service, prisma, lines } = build([order(1)]);
    lines.push(...CANCELLED_LINES);

    await service.changeStatus(1, 'IN_PROCESS', 'Леся');

    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('refuses a move the state machine does not allow', async () => {
    const row = order(1, { status: 'PENDING', cardDirty: false });
    const { service } = build([row]);

    const answer = await service.changeStatus(1, 'COMPLETED', 'Леся');

    expect(answer).toEqual({ text: 'Статус уже змінено: 🕐 Очікує' });
    expect(row.status).toBe('PENDING');
  });

  it('repairs the card behind a stale button', async () => {
    const row = order(1, {
      status: 'CANCELLED',
      cardDirty: false,
      notifyDirty: false,
      statusBy: 'Іван',
    });
    const { service } = build([row]);

    const answer = await service.changeStatus(1, 'IN_PROCESS', 'Леся');

    expect(answer).toEqual({ text: 'Статус уже змінено: ❌ Скасовано' });
    expect(row.cardDirty).toBe(true);
    expect(row.notifyDirty).toBe(false);
    expect(row.statusBy).toBe('Іван');
  });

  it('says so when the status is already there', async () => {
    const row = order(1, { status: 'IN_PROCESS', cardDirty: false });
    const { service } = build([row]);

    const answer = await service.changeStatus(1, 'IN_PROCESS', 'Леся');

    expect(answer).toEqual({ text: 'Цей статус вже встановлено' });
    expect(row.cardDirty).toBe(true);
  });

  it('alerts on an unknown order', async () => {
    const { service } = build([]);

    await expect(service.changeStatus(5, 'CANCELLED', 'Леся')).resolves.toEqual(
      { text: 'Замовлення не знайдено', show_alert: true },
    );
  });
});
