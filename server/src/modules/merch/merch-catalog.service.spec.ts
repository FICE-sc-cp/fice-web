import { createHash, createHmac } from 'crypto';
import {
  BadRequestException,
  GoneException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { MerchCatalogService } from './merch-catalog.service';
import type { Viewer } from './merch-catalog.service';
import { LINK_TTL_MS, SESSION_TTL_MS } from './merch-rules';

const TOKEN = '123456:merch-token';
const OTHER_TOKEN = '654321:another-bot';
const HOUR = 3_600_000;
const sha256 = (x: string) => createHash('sha256').update(x).digest('hex');
const inFuture = () => new Date(Date.now() + HOUR);
const inPast = () => new Date(Date.now() - HOUR);

/** Real Telegram signing, so wrong-bot data goes through the real validate(). */
function signedInitData(token: string, user: object) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'query-1',
    user: JSON.stringify(user),
  });
  const check = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
  return params.toString();
}

const req = (
  headers: Record<string, string> = {},
  query: Record<string, string> = {},
) => ({ headers, query }) as never;

type Work = (tx: unknown) => Promise<unknown>;

interface Row {
  id: number;
  telegramId: bigint;
  fullName: string;
  phone: string;
  isDefault: boolean;
}

/** merchRecipient over an array. A throw rolls back, like the real $transaction. */
function recipientTable(rows: Row[]) {
  const matches = (row: Row, where: Partial<Row>) =>
    (Object.keys(where) as (keyof Row)[]).every((k) => row[k] === where[k]);
  return {
    rows,
    count: jest.fn(
      ({ where }: { where: Partial<Row> }) =>
        rows.filter((r) => matches(r, where)).length,
    ),
    findFirst: jest.fn(
      ({ where }: { where: Partial<Row> }) =>
        rows.find((r) => matches(r, where)) ?? null,
    ),
    findMany: jest.fn(() => rows),
    findUnique: jest.fn(
      ({
        where: { telegramId_fullName_phone: key },
      }: {
        where: { telegramId_fullName_phone: Partial<Row> };
      }) => rows.find((r) => matches(r, key)) ?? null,
    ),
    deleteMany: jest.fn(({ where }: { where: Partial<Row> }) => {
      const kept = rows.filter((r) => !matches(r, where));
      rows.splice(0, rows.length, ...kept);
    }),
    updateMany: jest.fn(
      ({ where, data }: { where: Partial<Row>; data: Partial<Row> }) => {
        const hit = rows.filter((r) => matches(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      },
    ),
    upsert: jest.fn(
      ({
        where: { telegramId_fullName_phone: key },
        create,
      }: {
        where: { telegramId_fullName_phone: Partial<Row> };
        create: Omit<Row, 'id'>;
      }) => {
        const found = rows.find((r) => matches(r, key));
        if (found) return found;
        const row = { ...create, id: rows.length + 100 };
        rows.push(row);
        return row;
      },
    ),
  };
}

function build(options: { env?: Record<string, string>; bot?: string } = {}) {
  const env = options.env ?? { MERCH_BOT_TOKEN: TOKEN };
  const username = 'bot' in options ? options.bot : 'merch_test_bot';
  const recipients = recipientTable([]);
  const prisma = {
    merchLink: {
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    merchGroupMember: { findMany: jest.fn().mockResolvedValue([]) },
    merchVariant: { findMany: jest.fn().mockResolvedValue([]) },
    merchCustomer: { upsert: jest.fn() },
    merchRecipient: recipients,
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: Work) => {
    const before = recipients.rows.map((r) => ({ ...r }));
    try {
      return await fn(prisma);
    } catch (err) {
      recipients.rows.splice(0, recipients.rows.length, ...before);
      throw err;
    }
  });
  const service = new MerchCatalogService(
    prisma as never,
    { get: (key: string) => env[key] } as never,
    { getUsername: () => username } as never,
  );
  return { prisma, service };
}

describe('MerchCatalogService.viewer', () => {
  const USER = { id: 42, username: 'Good_User', first_name: 'Олена' };

  it('takes init data signed by the merch bot', async () => {
    const { service } = build();

    const viewer = await service.viewer(
      req({ 'x-telegram-init-data': signedInitData(TOKEN, USER) }),
    );

    expect(viewer).toEqual({
      telegramId: 42n,
      username: 'good_user',
      firstName: 'Олена',
      lastName: undefined,
    });
  });

  it("treats the site bot's init data as anonymous", async () => {
    const { service } = build({
      env: { MERCH_BOT_TOKEN: TOKEN, USER_BOT_TOKEN: OTHER_TOKEN },
    });

    const viewer = await service.viewer(
      req({ 'x-telegram-init-data': signedInitData(OTHER_TOKEN, USER) }),
    );

    expect(viewer).toBeNull();
  });

  it('is anonymous while the bot has no token', async () => {
    const { service } = build({ env: {} });

    const viewer = await service.viewer(
      req({ 'x-telegram-init-data': signedInitData(TOKEN, USER) }),
    );

    expect(viewer).toBeNull();
  });

  it('is anonymous with no header at all', async () => {
    const { prisma, service } = build();

    expect(await service.viewer(req())).toBeNull();
    expect(prisma.merchLink.findUnique).not.toHaveBeenCalled();
  });

  it('honours the dev query only under AUTH_DISABLED', async () => {
    const dev = { tgUserId: '1001', tgTag: 'Dev_Admin' };

    const on = build({ env: { AUTH_DISABLED: 'true' } }).service;
    expect(await on.viewer(req({}, dev))).toMatchObject({
      telegramId: 1001n,
      username: 'dev_admin',
    });
    expect(await build().service.viewer(req({}, dev))).toBeNull();
    expect(await on.viewer(req({}, { tgUserId: 'not-a-number' }))).toBeNull();
  });

  it('resolves a session by its hash, never by the token itself', async () => {
    const { prisma, service } = build();
    prisma.merchLink.findUnique.mockResolvedValue({
      expiresAt: inFuture(),
      customer: {
        telegramId: 7n,
        username: 'good_user',
        firstName: null,
        lastName: 'Коваль',
      },
    });

    const viewer = await service.viewer(req({ 'x-merch-token': 'session-1' }));

    expect(prisma.merchLink.findUnique).toHaveBeenCalledWith({
      where: { sessionHash: sha256('session-1') },
      include: { customer: true },
    });
    expect(viewer).toEqual({
      telegramId: 7n,
      username: 'good_user',
      firstName: undefined,
      lastName: 'Коваль',
    });
  });

  it('treats an expired session as anonymous', async () => {
    const { prisma, service } = build();
    prisma.merchLink.findUnique.mockResolvedValue({
      expiresAt: inPast(),
      customer: { telegramId: 7n },
    });

    const expired = req({ 'x-merch-token': 'old' });

    expect(await service.viewer(expired)).toBeNull();
    await expect(service.customer(expired)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('keeps an unknown token anonymous on public routes, 401 on customer ones', async () => {
    const { prisma, service } = build();
    prisma.merchLink.findUnique.mockResolvedValue(null);
    const unknown = req({ 'x-merch-token': 'stale' });

    expect(await service.viewer(unknown)).toBeNull();
    await expect(service.customer(unknown)).rejects.toMatchObject({
      status: 401,
      message: 'Увійдіть через Telegram ще раз.',
    });
  });

  it('a stale token does not fall through to init data', async () => {
    const { prisma, service } = build();
    prisma.merchLink.findUnique.mockResolvedValue(null);

    const viewer = await service.viewer(
      req({
        'x-merch-token': 'stale',
        'x-telegram-init-data': signedInitData(TOKEN, USER),
      }),
    );

    expect(viewer).toBeNull();
  });
});

describe('MerchCatalogService.ensureCustomer', () => {
  it('upserts names only, so a known customer keeps prompts and blocks', async () => {
    const { prisma, service } = build();

    await service.ensureCustomer({ telegramId: 7n, username: 'good_user' });

    const names = { username: 'good_user', firstName: null, lastName: null };
    expect(prisma.merchCustomer.upsert).toHaveBeenCalledWith({
      where: { telegramId: 7n },
      create: { telegramId: 7n, ...names },
      update: names,
    });
  });

  it('runs on the transaction it is given', async () => {
    const { prisma, service } = build();
    const tx = { merchCustomer: { upsert: jest.fn() } };

    await service.ensureCustomer({ telegramId: 7n }, tx as never);

    expect(tx.merchCustomer.upsert).toHaveBeenCalled();
    expect(prisma.merchCustomer.upsert).not.toHaveBeenCalled();
  });
});

describe('MerchCatalogService.groupIds', () => {
  it('matches a viewer without a username by id only, never every group', async () => {
    const { prisma, service } = build();

    await service.groupIds({ telegramId: 7n });

    expect(prisma.merchGroupMember.findMany).toHaveBeenCalledWith({
      where: { OR: [{ telegramId: 7n }] },
      select: { groupId: true },
    });
  });

  it('matches by id or stored username, each group once', async () => {
    const { prisma, service } = build();
    prisma.merchGroupMember.findMany.mockResolvedValue([
      { groupId: 3 },
      { groupId: 3 },
      { groupId: 5 },
    ]);

    const groups = await service.groupIds({
      telegramId: 7n,
      username: 'good_user',
    });

    expect(groups).toEqual([3, 5]);
    expect(prisma.merchGroupMember.findMany).toHaveBeenCalledWith({
      where: { OR: [{ telegramId: 7n }, { username: 'good_user' }] },
      select: { groupId: true },
    });
  });

  it('asks nothing for an anonymous viewer', async () => {
    const { prisma, service } = build();

    expect(await service.groupIds(null)).toEqual([]);
    expect(prisma.merchGroupMember.findMany).not.toHaveBeenCalled();
  });
});

describe('MerchCatalogService.catalog', () => {
  const ROW = { products: [], categories: [], tags: [] };

  it('is one read that carries the bot username', async () => {
    const { prisma, service } = build();
    prisma.$queryRaw.mockResolvedValue([ROW]);

    const catalog = await service.catalog([3]);

    expect(catalog).toEqual({ ...ROW, botUsername: 'merch_test_bot' });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).toHaveBeenCalledWith(expect.anything(), [3]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.merchLink.create).not.toHaveBeenCalled();
    expect(prisma.merchCustomer.upsert).not.toHaveBeenCalled();
  });

  it('has a null username while the bot is off', async () => {
    const { prisma, service } = build({ bot: undefined });
    prisma.$queryRaw.mockResolvedValue([ROW]);

    expect((await service.catalog([])).botUsername).toBeNull();
  });
});

describe('MerchCatalogService.product', () => {
  const ROW = {
    id: 1,
    title: 'Футболка',
    description: 'Опис',
    isActive: true,
    categoryId: null,
    variants: [
      { id: 5, size: 'M', color: '', price: '500.00', stock: 3, order: 0 },
    ],
    photos: [],
    tagIds: [],
    groupIds: [] as number[],
  };

  it('returns the view with the bot username', async () => {
    const { prisma, service } = build();
    prisma.$queryRaw.mockResolvedValue([ROW]);

    expect(await service.product(1, [])).toMatchObject({
      id: 1,
      archived: false,
      fixedSize: 'M',
      minPrice: '500.00',
      botUsername: 'merch_test_bot',
    });
  });

  it('answers a missing and a restricted product with the same 404', async () => {
    const { prisma, service } = build();
    prisma.$queryRaw.mockResolvedValueOnce([]);
    prisma.$queryRaw.mockResolvedValueOnce([{ ...ROW, groupIds: [9] }]);

    const missing = await service.product(1, []).catch((err: Error) => err);
    const hidden = await service.product(1, []).catch((err: Error) => err);

    expect(missing).toBeInstanceOf(NotFoundException);
    expect(hidden).toBeInstanceOf(NotFoundException);
    expect((missing as NotFoundException).getResponse()).toEqual(
      (hidden as NotFoundException).getResponse(),
    );
    expect((missing as Error).message).toBe('Товар не знайдено.');
  });

  it('shows a restricted product to a member of its group', async () => {
    const { prisma, service } = build();
    prisma.$queryRaw.mockResolvedValue([{ ...ROW, groupIds: [9] }]);

    expect((await service.product(1, [9])).id).toBe(1);
  });
});

describe('MerchCatalogService.preview', () => {
  const variant = (id: number, overrides: Record<string, unknown> = {}) => ({
    id,
    productId: 1,
    size: 'M',
    color: 'Білий',
    price: { toFixed: () => '500.00' },
    stock: 2,
    product: {
      title: 'Футболка',
      isActive: true,
      groups: [] as { groupId: number }[],
      photos: [
        { color: '', thumbUrl: '/uploads/plain.jpg' },
        { color: 'Білий', thumbUrl: '/uploads/white.jpg' },
      ],
    },
    ...overrides,
  });

  it('prices from live rows, with the photo of the line colour', async () => {
    const { prisma, service } = build();
    prisma.merchVariant.findMany.mockResolvedValue([variant(5)]);

    const preview = await service.preview([{ variantId: 5, quantity: 2 }], []);

    expect(preview).toMatchObject({ total: '1000.00', hasProblems: false });
    expect(preview.lines[0]).toMatchObject({
      options: 'M — Білий',
      thumbUrl: '/uploads/white.jpg',
    });
  });

  it('falls back to the colourless photo, then to none', async () => {
    const { prisma, service } = build();
    const base = variant(5);
    prisma.merchVariant.findMany.mockResolvedValue([
      variant(5, { color: 'Чорний' }),
      variant(6, { product: { ...base.product, photos: [] } }),
    ]);

    const { lines } = await service.preview(
      [
        { variantId: 5, quantity: 1 },
        { variantId: 6, quantity: 1 },
      ],
      [],
    );

    expect(lines.map((l) => l.thumbUrl)).toEqual(['/uploads/plain.jpg', null]);
  });

  it('merges a repeated variant before checking its stock', async () => {
    const { prisma, service } = build();
    prisma.merchVariant.findMany.mockResolvedValue([variant(5)]);

    const { lines } = await service.preview(
      [
        { variantId: 5, quantity: 2 },
        { variantId: 5, quantity: 2 },
      ],
      [],
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ quantity: 4, status: 'short' });
  });

  it('reads a restricted line exactly like a missing one', async () => {
    const { prisma, service } = build();
    const base = variant(5);
    prisma.merchVariant.findMany.mockResolvedValue([
      variant(5, { product: { ...base.product, groups: [{ groupId: 9 }] } }),
    ]);

    const { lines } = await service.preview(
      [
        { variantId: 5, quantity: 1 },
        { variantId: 6, quantity: 1 },
      ],
      [],
    );

    const gone = (variantId: number) => ({
      variantId,
      productId: null,
      title: null,
      size: null,
      color: '',
      options: '',
      thumbUrl: null,
      unitPrice: null,
      lineTotal: '0.00',
      quantity: 1,
      maxQuantity: 0,
      status: 'gone',
    });
    expect(lines).toEqual([gone(5), gone(6)]);
  });
});

describe('MerchCatalogService link flow', () => {
  const TOKEN_32 = 'a'.repeat(32);

  it('refuses with 503 while the bot is off and writes nothing', async () => {
    const { prisma, service } = build({ bot: undefined });

    const failure = await service.startLink().catch((err: Error) => err);

    expect(failure).toBeInstanceOf(ServiceUnavailableException);
    expect((failure as Error).message).toBe(
      'Оформлення через сайт тимчасово недоступне: бот не налаштований.',
    );
    expect(prisma.merchLink.deleteMany).not.toHaveBeenCalled();
    expect(prisma.merchLink.create).not.toHaveBeenCalled();
  });

  it('sweeps expired rows, then starts a 15 minute link', async () => {
    const { prisma, service } = build();
    const before = Date.now();

    const link = await service.startLink();

    expect(prisma.merchLink.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) as Date } },
    });
    expect(link.token).toMatch(/^[0-9a-f]{32}$/);
    expect(link.botUrl).toBe(
      `https://t.me/merch_test_bot?start=link_${link.token}`,
    );
    expect(prisma.merchLink.create).toHaveBeenCalledWith({
      data: {
        linkToken: link.token,
        expiresAt: new Date(link.expiresAt),
      },
    });
    expect(new Date(link.expiresAt).getTime()).toBeGreaterThanOrEqual(
      before + LINK_TTL_MS,
    );
  });

  it('answers 404 for a malformed token without a query', async () => {
    const { prisma, service } = build();

    await expect(service.pollLink('not-a-token')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.merchLink.findUnique).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown token', async () => {
    const { prisma, service } = build();
    prisma.merchLink.findUnique.mockResolvedValue(null);

    await expect(service.pollLink(TOKEN_32)).rejects.toMatchObject({
      status: 404,
      message: 'Сесію не знайдено',
    });
  });

  it('stays pending until someone confirms in the bot', async () => {
    const { prisma, service } = build();
    prisma.merchLink.findUnique.mockResolvedValue({
      id: 1,
      telegramId: null,
      expiresAt: inFuture(),
    });

    expect(await service.pollLink(TOKEN_32)).toEqual({ linked: false });
    expect(prisma.merchLink.updateMany).not.toHaveBeenCalled();
  });

  it('answers 410 once the link has expired', async () => {
    const { prisma, service } = build();
    prisma.merchLink.findUnique.mockResolvedValue({
      id: 1,
      telegramId: 7n,
      expiresAt: inPast(),
    });

    const failure = await service.pollLink(TOKEN_32).catch((err: Error) => err);

    expect(failure).toBeInstanceOf(GoneException);
    expect((failure as Error).message).toBe('Посилання застаріло');
  });

  it('issues the session once and stores only its hash', async () => {
    const { prisma, service } = build();
    prisma.merchLink.findUnique.mockResolvedValueOnce({
      id: 1,
      telegramId: 7n,
      expiresAt: inFuture(),
    });
    const before = Date.now();

    const first = await service.pollLink(TOKEN_32);

    expect(first.linked).toBe(true);
    const { session } = first as { session: string };
    const [update] = prisma.merchLink.updateMany.mock.calls[0] as [
      {
        where: unknown;
        data: { sessionHash: string; linkToken: null; expiresAt: Date };
      },
    ];
    expect(update.where).toEqual({ id: 1, sessionHash: null });
    expect(update.data.sessionHash).toBe(sha256(session));
    expect(update.data.linkToken).toBeNull();
    expect(update.data.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + SESSION_TTL_MS,
    );

    // The claim cleared linkToken, so the second poll finds nothing.
    prisma.merchLink.findUnique.mockResolvedValueOnce(null);
    await expect(service.pollLink(TOKEN_32)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('gives a poll that loses the claim a 404, not a second session', async () => {
    const { prisma, service } = build();
    prisma.merchLink.findUnique.mockResolvedValue({
      id: 1,
      telegramId: 7n,
      expiresAt: inFuture(),
    });
    prisma.merchLink.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.pollLink(TOKEN_32)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('ends a session by hash and stays idempotent', async () => {
    const { prisma, service } = build();

    expect(await service.endLink('session-1')).toEqual({ ok: true });
    expect(prisma.merchLink.deleteMany).toHaveBeenCalledWith({
      where: { sessionHash: sha256('session-1') },
    });

    prisma.merchLink.deleteMany.mockClear();
    expect(await service.endLink(undefined)).toEqual({ ok: true });
    expect(prisma.merchLink.deleteMany).not.toHaveBeenCalled();
  });
});

describe('MerchCatalogService recipients', () => {
  const ME: Viewer = { telegramId: 7n };
  const row = (id: number, telegramId: bigint, isDefault = false): Row => ({
    id,
    telegramId,
    fullName: `Отримувач ${id}`,
    phone: `+38050000000${id}`,
    isDefault,
  });

  function withRows(...rows: Row[]) {
    const built = build();
    built.prisma.merchRecipient.rows.push(...rows);
    return { ...built, table: built.prisma.merchRecipient.rows };
  }

  it('lists only the fields the client shows, by id, for this customer', async () => {
    const { prisma, service } = withRows();

    await service.recipients(ME);

    expect(prisma.merchRecipient.findMany).toHaveBeenCalledWith({
      where: { telegramId: 7n },
      orderBy: { id: 'asc' },
      select: { id: true, fullName: true, phone: true, isDefault: true },
    });
  });

  it('refuses a bad phone before touching the database', async () => {
    const { prisma, service } = withRows();

    await expect(
      service.addRecipient(ME, { fullName: 'Олена', phone: '12345' }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Вкажіть коректний номер телефону.',
    });
    expect(prisma.merchCustomer.upsert).not.toHaveBeenCalled();
  });

  it('refuses a name of spaces', async () => {
    const { service } = withRows();

    await expect(
      service.addRecipient(ME, { fullName: '   ', phone: '0501234567' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('makes the first recipient the default, stored normalized and trimmed', async () => {
    const { prisma, service, table } = withRows();

    const { id } = await service.addRecipient(ME, {
      fullName: ' Олена Коваль ',
      phone: '(050) 123-45-67',
    });

    expect(table).toEqual([
      {
        id,
        telegramId: 7n,
        fullName: 'Олена Коваль',
        phone: '+380501234567',
        isDefault: true,
      },
    ]);
    expect(prisma.merchCustomer.upsert).toHaveBeenCalledTimes(1);
  });

  it('runs ensureCustomer before the recipient, in one transaction', async () => {
    const { prisma, service } = withRows();

    await service.addRecipient(ME, {
      fullName: 'Олена',
      phone: '0501234567',
    });

    const [ensure] = prisma.merchCustomer.upsert.mock.invocationCallOrder;
    const [save] = prisma.merchRecipient.upsert.mock.invocationCallOrder;
    expect(ensure).toBeLessThan(save);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('counts only own recipients when choosing the default', async () => {
    const { service, table } = withRows(row(1, 99n, true));

    await service.addRecipient(ME, {
      fullName: 'Олена',
      phone: '0501234567',
    });

    expect(table[1]).toMatchObject({ telegramId: 7n, isDefault: true });
  });

  it('adds later recipients without touching the default', async () => {
    const { service, table } = withRows(row(1, 7n, true));

    await service.addRecipient(ME, {
      fullName: 'Олена',
      phone: '0501234567',
    });

    expect(table.map((r) => r.isDefault)).toEqual([true, false]);
  });

  it('treats re-adding the same person as success', async () => {
    const { service, table } = withRows();
    const dto = { fullName: 'Олена', phone: '0501234567' };

    const first = await service.addRecipient(ME, dto);
    const second = await service.addRecipient(ME, {
      ...dto,
      phone: '+380 50 123 45 67',
    });

    expect(second.id).toBe(first.id);
    expect(table).toHaveLength(1);
  });

  it('refuses a new recipient at the cap, and keeps re-adding working', async () => {
    const kept = Array.from({ length: 20 }, (_, i) => row(i + 1, 7n));
    const { service, table } = withRows(...kept);

    await expect(
      service.addRecipient(ME, { fullName: 'Новий', phone: '0501234567' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(table).toHaveLength(20);

    await expect(
      service.addRecipient(ME, {
        fullName: kept[0].fullName,
        phone: kept[0].phone,
      }),
    ).resolves.toEqual(expect.objectContaining({ id: kept[0].id }));
  });

  it('hands the default to the oldest remaining on delete', async () => {
    const { service, table } = withRows(
      row(1, 7n, true),
      row(2, 7n),
      row(3, 7n),
      row(4, 99n, true),
    );

    expect(await service.deleteRecipient(ME, 1)).toEqual({ ok: true });

    expect(table.map((r) => [r.id, r.isDefault])).toEqual([
      [2, true],
      [3, false],
      [4, true],
    ]);
  });

  it('leaves the default alone when another row goes', async () => {
    const { service, table } = withRows(
      row(1, 7n),
      row(2, 7n, true),
      row(3, 7n),
    );

    await service.deleteRecipient(ME, 3);

    expect(table.map((r) => [r.id, r.isDefault])).toEqual([
      [1, false],
      [2, true],
    ]);
  });

  it('survives deleting the last recipient', async () => {
    const { service, table } = withRows(row(1, 7n, true));

    await service.deleteRecipient(ME, 1);

    expect(table).toEqual([]);
  });

  it("cannot delete someone else's recipient", async () => {
    const { service, table } = withRows(row(4, 99n, true));

    await expect(service.deleteRecipient(ME, 4)).rejects.toMatchObject({
      status: 404,
      message: 'Отримувача не знайдено.',
    });
    expect(table).toHaveLength(1);
  });

  it('moves the default inside this customer only', async () => {
    const { service, table } = withRows(
      row(1, 7n, true),
      row(2, 7n),
      row(4, 99n, true),
    );

    expect(await service.defaultRecipient(ME, 2)).toEqual({ ok: true });

    expect(table.map((r) => [r.id, r.isDefault])).toEqual([
      [1, false],
      [2, true],
      [4, true],
    ]);
  });

  it("rolls back when the default target is someone else's", async () => {
    const { service, table } = withRows(row(1, 7n, true), row(4, 99n));

    await expect(service.defaultRecipient(ME, 4)).rejects.toMatchObject({
      status: 404,
      message: 'Отримувача не знайдено.',
    });
    expect(table.map((r) => [r.id, r.isDefault])).toEqual([
      [1, true],
      [4, false],
    ]);
  });
});
