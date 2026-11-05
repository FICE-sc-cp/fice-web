import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ownUploadExists } from '../../upload/own-upload';
import { MerchCatalogService } from './merch-catalog.service';
import type { Viewer } from './merch-catalog.service';
import { MerchOrderService } from './merch-order.service';
import { MAX_PENDING_ORDERS, NO_SIZE } from './merch-rules';
import type { VariantNow } from './merch-rules';
import type { CreateOrderDto } from './merch.dto';

jest.mock('../../upload/own-upload', () => ({
  ...jest.requireActual<object>('../../upload/own-upload'),
  ownUploadExists: jest.fn(() => true),
}));

const RECEIPT = '/uploads/0e352379-dbd8-407f-98a5-38d60ab53528.jpg';
const KEY = '7f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const ME: Viewer = { telegramId: 7n, username: 'good_user' };

const variant = (overrides: Partial<VariantNow> = {}): VariantNow => ({
  id: 1,
  productId: 10,
  title: 'Футболка',
  isActive: true,
  groupIds: [],
  size: 'M',
  color: 'Білий',
  price: '500.00',
  stock: 10,
  ...overrides,
});

const body = (overrides: Partial<CreateOrderDto> = {}): CreateOrderDto => ({
  clientKey: KEY,
  lines: [{ variantId: 1, quantity: 2, label: 'Футболка (M — Білий)' }],
  expectedTotal: '1000.00',
  delivery: 'LATER_CAMPUS',
  recipientName: 'Олена Коваль',
  recipientPhone: '050 123 45 67',
  receiptUrl: RECEIPT,
  ...overrides,
});

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('failed', {
    code,
    clientVersion: 'test',
  });

type Work = (tx: unknown) => Promise<unknown>;

interface OrderData {
  [key: string]: unknown;
  totalAmount: string;
  warnings: string[];
  items: { create: Record<string, unknown>[] };
}

function build(
  options: {
    variants?: VariantNow[];
    shop?: Record<string, unknown>;
    recent?: number;
    pending?: number;
    ownRecipients?: number;
  } = {},
) {
  const count = jest.fn(({ where }: { where: { status?: string } }) =>
    Promise.resolve(
      where.status === 'PENDING'
        ? (options.pending ?? 0)
        : (options.recent ?? 0),
    ),
  );
  const prisma = {
    merchOrder: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count,
      create: jest.fn(({ data }: { data: OrderData }) =>
        Promise.resolve({
          id: 77,
          totalAmount: new Prisma.Decimal(data.totalAmount),
        }),
      ),
    },
    merchVariant: {
      update: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    merchCustomer: { upsert: jest.fn() },
    merchRecipient: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(options.ownRecipients ?? 0),
      upsert: jest.fn().mockResolvedValue({ id: 1 }),
    },
    merchPickupSlot: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue(options.variants ?? [variant()]),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: Work) => fn(prisma));
  const bot = {
    getUsername: () => 'merch_test_bot',
    kick: jest.fn(),
    shopConfig: jest.fn().mockResolvedValue({
      currency: 'UAH',
      dayfEnabled: true,
      monoJarUrl: 'https://send.monobank.ua/jar/test',
      cardNumber: '4441 1111 2222 3333',
      adminChatId: -100123n,
      ...options.shop,
    }),
  };
  const catalog = new MerchCatalogService(
    prisma as never,
    { get: () => undefined } as never,
    bot as never,
  );
  const service = new MerchOrderService(prisma as never, catalog, bot as never);
  const orderData = () =>
    (prisma.merchOrder.create.mock.calls[0][0] as { data: OrderData }).data;
  return { prisma, bot, service, orderData };
}

beforeEach(() => {
  (ownUploadExists as jest.Mock).mockReturnValue(true);
});

describe('MerchOrderService.createOrder', () => {
  it('creates the order with snapshots, flags and live prices', async () => {
    const { prisma, bot, service, orderData } = build();

    const created = await service.createOrder(ME, body(), []);

    expect(created).toEqual({ id: 77, total: '1000.00', repeated: false });
    expect(orderData()).toMatchObject({
      telegramId: 7n,
      deliveryMethod: 'LATER_CAMPUS',
      address: 'Пізніше в корпусі',
      phone: '+380501234567',
      recipientName: 'Олена Коваль',
      totalAmount: '1000.00',
      currency: 'UAH',
      receiptUrl: RECEIPT,
      clientKey: KEY,
      warnings: [],
      cardDirty: true,
      notifyDirty: true,
    });
    expect(orderData().items.create).toEqual([
      {
        productId: 10,
        variantId: 1,
        title: 'Футболка',
        size: 'M',
        color: 'Білий',
        unitPrice: '500.00',
        quantity: 2,
        stockTaken: 2,
      },
    ]);
    expect(prisma.merchVariant.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { stock: 8 },
    });
    expect(prisma.merchCustomer.upsert).toHaveBeenCalledTimes(1);
    expect(bot.kick).toHaveBeenCalledTimes(1);
  });

  it('never calls Telegram itself and gives the queue time to wait', async () => {
    const { prisma, service } = build();

    await service.createOrder(ME, body(), []);

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 10_000,
      timeout: 15_000,
    });
  });

  it('locks the variants in id order, whatever order the lines came in', async () => {
    const { prisma, service } = build();

    await service.createOrder(
      ME,
      body({
        lines: [
          { variantId: 9, quantity: 1, label: 'a' },
          { variantId: 2, quantity: 1, label: 'b' },
        ],
      }),
      [],
    );

    const [strings, ids] = prisma.$queryRaw.mock.calls[0] as [
      string[],
      number[],
    ];
    expect(strings.join('?')).toContain('ORDER BY v.id FOR UPDATE OF v');
    expect(ids).toEqual([9, 2]);
  });

  it('prices at the live price, not at what the client sent', async () => {
    const { service, orderData } = build({
      variants: [variant({ price: '12.50' })],
    });

    const created = await service.createOrder(
      ME,
      body({ expectedTotal: '1.00' }),
      [],
    );

    expect(created.total).toBe('25.00');
    expect(orderData().totalAmount).toBe('25.00');
  });

  it('returns the same order for the same key, with no stock or limits', async () => {
    const { prisma, bot, service } = build({
      recent: 99,
      pending: MAX_PENDING_ORDERS,
    });
    prisma.merchOrder.findUnique.mockResolvedValue({
      id: 41,
      totalAmount: new Prisma.Decimal('1000'),
    });

    const created = await service.createOrder(ME, body(), []);

    expect(created).toEqual({ id: 41, total: '1000.00', repeated: true });
    expect(prisma.merchOrder.findUnique).toHaveBeenCalledWith({
      where: { telegramId_clientKey: { telegramId: 7n, clientKey: KEY } },
      select: { id: true, totalAmount: true },
    });
    expect(prisma.merchOrder.count).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.merchVariant.update).not.toHaveBeenCalled();
    expect(bot.kick).not.toHaveBeenCalled();
  });

  it('returns the winner of a P2002 race', async () => {
    const { prisma, bot, service } = build();
    prisma.merchOrder.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 41,
        totalAmount: new Prisma.Decimal('1000'),
      });
    prisma.$transaction.mockRejectedValue(prismaError('P2002'));

    expect(await service.createOrder(ME, body(), [])).toEqual({
      id: 41,
      total: '1000.00',
      repeated: true,
    });
    expect(bot.kick).not.toHaveBeenCalled();
  });

  it('rethrows a P2002 that no order explains', async () => {
    const { prisma, service } = build();
    prisma.$transaction.mockRejectedValue(prismaError('P2002'));

    await expect(service.createOrder(ME, body(), [])).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it.each(['P2028', 'P2024', 'P2034', 'P2010'])(
    'turns %s into a retriable 503',
    async (code) => {
      const { prisma, bot, service } = build();
      prisma.$transaction.mockRejectedValue(prismaError(code));

      const failure = await service
        .createOrder(ME, body(), [])
        .catch((err: Error) => err);

      expect(failure).toBeInstanceOf(ServiceUnavailableException);
      expect((failure as Error).message).toBe('Спробуйте ще раз за хвилину.');
      expect(bot.kick).not.toHaveBeenCalled();
    },
  );

  it('lets anything that is not a Prisma error through unchanged', async () => {
    const { prisma, service } = build();
    const bug = new TypeError('bug');
    prisma.$transaction.mockRejectedValue(bug);

    await expect(service.createOrder(ME, body(), [])).rejects.toBe(bug);
  });

  describe('stock', () => {
    it('accepts a short line, floors at 0 and keeps what was really taken', async () => {
      const { prisma, service, orderData } = build({
        variants: [variant({ stock: 3 })],
      });

      const created = await service.createOrder(
        ME,
        body({
          lines: [{ variantId: 1, quantity: 5, label: 'x' }],
          expectedTotal: '2500.00',
        }),
        [],
      );

      expect(created.total).toBe('2500.00');
      expect(prisma.merchVariant.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { stock: 0 },
      });
      expect(orderData().items.create[0]).toMatchObject({
        quantity: 5,
        stockTaken: 3,
      });
      expect(orderData().warnings).toEqual([
        '⚠️ Не вистачило: Футболка M — Білий: замовлено 5, було 3',
      ]);
    });

    it('leaves unlimited stock alone', async () => {
      const { prisma, service, orderData } = build({
        variants: [variant({ stock: null })],
      });

      await service.createOrder(ME, body(), []);

      expect(prisma.merchVariant.update).not.toHaveBeenCalled();
      expect(orderData().items.create[0]).toMatchObject({ stockTaken: 0 });
    });

    it('merges a repeated line into one stock change', async () => {
      const { prisma, service, orderData } = build();

      await service.createOrder(
        ME,
        body({
          lines: [
            { variantId: 1, quantity: 1, label: 'x' },
            { variantId: 1, quantity: 1, label: 'x' },
          ],
        }),
        [],
      );

      expect(prisma.merchVariant.update).toHaveBeenCalledTimes(1);
      expect(orderData().items.create).toHaveLength(1);
      expect(orderData().items.create[0]).toMatchObject({ quantity: 2 });
    });
  });

  describe('warnings', () => {
    it('keeps the server total when expectedTotal is wrong', async () => {
      const { service, orderData } = build();

      await service.createOrder(ME, body({ expectedTotal: '900.00' }), []);

      expect(orderData().totalAmount).toBe('1000.00');
      expect(orderData().warnings).toEqual([
        '⚠️ Сума не збігається: клієнт бачив 900.00, сервер порахував 1000.00 грн',
      ]);
    });

    it('gives an order at total 0 with warnings when all lines are gone', async () => {
      const { prisma, bot, service, orderData } = build({ variants: [] });

      const created = await service.createOrder(ME, body(), []);

      expect(created).toEqual({ id: 77, total: '0.00', repeated: false });
      expect(orderData().items.create).toEqual([]);
      expect(orderData().receiptUrl).toBe(RECEIPT);
      expect(orderData().warnings).toEqual([
        '⚠️ Позицію видалено: Футболка (M — Білий) × 2. Ціну не перевірено.',
        '⚠️ Сума не збігається: клієнт бачив 1000.00, сервер порахував 0.00 грн',
      ]);
      expect(prisma.merchVariant.update).not.toHaveBeenCalled();
      expect(bot.kick).toHaveBeenCalled();
    });

    it('keeps a hidden line out and tells only the admin', async () => {
      const { prisma, service, orderData } = build({
        variants: [variant({ groupIds: [9] })],
      });

      const created = await service.createOrder(
        ME,
        body({ expectedTotal: '0.00' }),
        [3],
      );

      expect(created.total).toBe('0.00');
      expect(orderData().items.create).toEqual([]);
      expect(orderData().warnings).toEqual([
        '⚠️ Товар не для цього покупця: Футболка × 2',
      ]);
      expect(prisma.merchVariant.update).not.toHaveBeenCalled();
    });

    it('takes an archived line and warns', async () => {
      const { prisma, service, orderData } = build({
        variants: [variant({ isActive: false })],
      });

      await service.createOrder(ME, body(), []);

      expect(orderData().items.create).toHaveLength(1);
      expect(orderData().warnings).toEqual(['⚠️ Товар уже в архіві: Футболка']);
      expect(prisma.merchVariant.update).toHaveBeenCalled();
    });

    it('accepts DayF after it was turned off, with a warning', async () => {
      const { service, orderData } = build({ shop: { dayfEnabled: false } });

      await service.createOrder(ME, body({ delivery: 'DAYF' }), []);

      expect(orderData()).toMatchObject({
        deliveryMethod: 'DAYF',
        address: 'На DayF',
      });
      expect(orderData().warnings).toEqual([
        '⚠️ DayF вимкнено, клієнт обрав його до вимкнення',
      ]);
    });

    it('stays quiet about DayF while it is on', async () => {
      const { service, orderData } = build();

      await service.createOrder(ME, body({ delivery: 'DAYF' }), []);

      expect(orderData().warnings).toEqual([]);
    });
  });

  describe('limits', () => {
    it('refuses a sixth order within a minute', async () => {
      const { prisma, service } = build({ recent: 5 });

      const failure = await service
        .createOrder(ME, body(), [])
        .catch((err: Error) => err);

      expect(failure).toBeInstanceOf(HttpException);
      expect((failure as HttpException).getStatus()).toBe(429);
      expect((failure as Error).message).toBe(
        'Забагато спроб. Зачекайте хвилину.',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('counts the rate only over the last minute of this customer', async () => {
      const { prisma, service } = build({ recent: 4 });
      const before = Date.now();

      await service.createOrder(ME, body(), []);

      const [{ where }] = prisma.merchOrder.count.mock.calls[0] as unknown as [
        { where: { telegramId: bigint; createdAt: { gt: Date } } },
      ];
      expect(where.telegramId).toBe(7n);
      expect(where.createdAt.gt.getTime()).toBeGreaterThanOrEqual(
        before - 60_000,
      );
    });

    it('refuses at the pending cap', async () => {
      const { prisma, service } = build({ pending: MAX_PENDING_ORDERS });

      const failure = await service
        .createOrder(ME, body(), [])
        .catch((err: Error) => err);

      expect((failure as HttpException).getStatus()).toBe(429);
      expect((failure as Error).message).toBe(
        'Забагато необроблених замовлень. Зачекайте на перевірку адміністратора.',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('lets the order below the cap through', async () => {
      const { service } = build({ pending: MAX_PENDING_ORDERS - 1 });

      await expect(service.createOrder(ME, body(), [])).resolves.toMatchObject({
        repeated: false,
      });
    });
  });

  describe('validation before any write', () => {
    const noWrites = (prisma: ReturnType<typeof build>['prisma']) => {
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.merchCustomer.upsert).not.toHaveBeenCalled();
    };

    it('refuses a recipient of someone else', async () => {
      const { prisma, service } = build();

      await expect(
        service.createOrder(ME, body({ recipientId: 5 }), []),
      ).rejects.toMatchObject({
        status: 404,
        message: 'Отримувача не знайдено.',
      });
      expect(prisma.merchRecipient.findFirst).toHaveBeenCalledWith({
        where: { id: 5, telegramId: 7n },
      });
      noWrites(prisma);
    });

    it.each([
      ['no name', { recipientName: undefined }],
      ['a blank name', { recipientName: '   ' }],
      ['no phone', { recipientPhone: undefined }],
      ['a blank phone', { recipientPhone: '   ' }],
    ])('refuses %s', async (_case, overrides) => {
      const { prisma, service } = build();

      await expect(
        service.createOrder(ME, body(overrides), []),
      ).rejects.toMatchObject({
        status: 400,
        message: 'Заповніть дані отримувача.',
      });
      noWrites(prisma);
    });

    it('refuses a bad phone', async () => {
      const { prisma, service } = build();

      await expect(
        service.createOrder(ME, body({ recipientPhone: '12345' }), []),
      ).rejects.toMatchObject({
        status: 400,
        message: 'Вкажіть коректний номер телефону.',
      });
      noWrites(prisma);
    });

    it.each([undefined, '   '])(
      'needs an address for Нова Пошта (%j)',
      async (address) => {
        const { prisma, service } = build();

        await expect(
          service.createOrder(
            ME,
            body({ delivery: 'NOVA_POSHTA', address }),
            [],
          ),
        ).rejects.toMatchObject({
          status: 400,
          message: 'Вкажіть адресу для Нової Пошти.',
        });
        noWrites(prisma);
      },
    );

    it('refuses a receipt file that is gone', async () => {
      const { prisma, service } = build();
      (ownUploadExists as jest.Mock).mockReturnValue(false);

      await expect(service.createOrder(ME, body(), [])).rejects.toMatchObject({
        status: 400,
        message: 'Квитанцію не знайдено. Завантажте її ще раз.',
      });
      noWrites(prisma);
    });
  });

  describe('recipient', () => {
    it('takes name and phone from a saved recipient and saves nothing', async () => {
      const { prisma, service, orderData } = build();
      prisma.merchRecipient.findFirst.mockResolvedValue({
        id: 5,
        fullName: 'Збережена Особа',
        phone: '+380671112233',
      });

      await service.createOrder(
        ME,
        body({
          recipientId: 5,
          recipientName: 'Хтось Інший',
          saveRecipient: true,
        }),
        [],
      );

      expect(orderData()).toMatchObject({
        recipientName: 'Збережена Особа',
        phone: '+380671112233',
      });
      expect(prisma.merchRecipient.upsert).not.toHaveBeenCalled();
    });

    it('does not save a typed recipient unless asked', async () => {
      const { prisma, service } = build();

      await service.createOrder(ME, body(), []);

      expect(prisma.merchRecipient.upsert).not.toHaveBeenCalled();
    });

    it("saves a customer's first recipient as the default", async () => {
      const { prisma, service } = build();

      await service.createOrder(ME, body({ saveRecipient: true }), []);

      const key = {
        telegramId: 7n,
        fullName: 'Олена Коваль',
        phone: '+380501234567',
      };
      expect(prisma.merchRecipient.upsert).toHaveBeenCalledWith({
        where: { telegramId_fullName_phone: key },
        create: { ...key, isDefault: true },
        update: {},
        select: { id: true },
      });
    });

    it('adds a further recipient without the default mark', async () => {
      const { prisma, service } = build({ ownRecipients: 2 });

      await service.createOrder(ME, body({ saveRecipient: true }), []);

      expect(prisma.merchRecipient.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isDefault: false }) as object,
        }),
      );
    });

    it('takes the order without saving a recipient over the cap', async () => {
      const { prisma, service } = build({ ownRecipients: 20 });

      await expect(
        service.createOrder(ME, body({ saveRecipient: true }), []),
      ).resolves.toMatchObject({ repeated: false });

      expect(prisma.merchRecipient.upsert).not.toHaveBeenCalled();
    });

    it('writes only on the transaction, so a failed order leaves nothing', async () => {
      const { prisma, service } = build();
      const tx = {
        ...prisma,
        merchCustomer: { upsert: jest.fn() },
        merchVariant: { update: jest.fn() },
        merchRecipient: {
          ...prisma.merchRecipient,
          upsert: jest.fn().mockResolvedValue({ id: 1 }),
        },
        merchOrder: {
          create: jest.fn().mockRejectedValue(prismaError('P2028')),
        },
      };
      prisma.$transaction.mockImplementation((fn: Work) => fn(tx));

      await expect(
        service.createOrder(ME, body({ saveRecipient: true }), []),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);

      expect(tx.merchCustomer.upsert).toHaveBeenCalled();
      expect(tx.merchVariant.update).toHaveBeenCalled();
      expect(tx.merchRecipient.upsert).toHaveBeenCalled();
      expect(prisma.merchCustomer.upsert).not.toHaveBeenCalled();
      expect(prisma.merchVariant.update).not.toHaveBeenCalled();
      expect(prisma.merchRecipient.upsert).not.toHaveBeenCalled();
      expect(prisma.merchOrder.create).not.toHaveBeenCalled();
    });
  });
});

describe('MerchOrderService.startCheckout', () => {
  const LINES = [{ variantId: 1, quantity: 1 }];

  it('refuses at the pending cap, before the customer pays', async () => {
    const { prisma, service } = build({ pending: MAX_PENDING_ORDERS });

    const failure = await service
      .startCheckout(ME, LINES, [])
      .catch((err: Error) => err);

    expect((failure as HttpException).getStatus()).toBe(429);
    expect((failure as Error).message).toBe(
      'Забагато необроблених замовлень. Зачекайте на перевірку адміністратора.',
    );
    expect(prisma.merchVariant.findMany).not.toHaveBeenCalled();
  });

  it('is not rate limited: looking at a cart costs no order', async () => {
    const { service } = build({ recent: 99 });

    await expect(service.startCheckout(ME, LINES, [])).resolves.toBeDefined();
  });

  it('serves the priced cart, own recipients and only the payment fields', async () => {
    const { prisma, service } = build();
    const recipients = [
      { id: 1, fullName: 'Олена', phone: '+380', isDefault: true },
    ];
    prisma.merchRecipient.findMany.mockResolvedValue(recipients);

    const start = await service.startCheckout(ME, LINES, []);

    expect(start.recipients).toEqual(recipients);
    expect(start.cart.lines[0].status).toBe('gone');
    // JSON cannot hold adminChatId, a BigInt, and it is nobody's business.
    expect(start.shop).toEqual({
      monoJarUrl: 'https://send.monobank.ua/jar/test',
      cardNumber: '4441 1111 2222 3333',
      dayfEnabled: true,
      currency: 'UAH',
    });
  });
});

describe('MerchOrderService.listOrders', () => {
  const decimal = (v: string) => new Prisma.Decimal(v);
  const stored = (overrides: Record<string, unknown> = {}) => ({
    id: 5,
    status: 'READY_FOR_PICKUP',
    totalAmount: decimal('1000'),
    createdAt: new Date('2026-11-02T10:00:00Z'),
    deliveryMethod: 'LATER_CAMPUS',
    address: 'Пізніше в корпусі',
    pickupSlotId: null,
    pickupSlot: null,
    needsIndividualPickup: false,
    items: [
      {
        title: 'Наліпка',
        size: NO_SIZE,
        color: '',
        quantity: 2,
        unitPrice: decimal('50'),
      },
      {
        title: 'Футболка',
        size: 'M',
        color: 'Білий',
        quantity: 1,
        unitPrice: decimal('900.5'),
      },
    ],
    ...overrides,
  });

  it('asks for own orders, newest first, at most 100', async () => {
    const { prisma, service } = build();

    await service.listOrders(ME);

    expect(prisma.merchOrder.findMany).toHaveBeenCalledWith({
      where: { telegramId: 7n },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { items: { orderBy: { id: 'asc' } }, pickupSlot: true },
    });
  });

  it('maps a row to strings, without NO_SIZE and with the server pickup rule', async () => {
    const { prisma, service } = build();
    prisma.merchOrder.findMany.mockResolvedValue([stored()]);

    expect(await service.listOrders(ME)).toEqual([
      {
        id: 5,
        status: 'READY_FOR_PICKUP',
        totalAmount: '1000.00',
        createdAt: '2026-11-02T10:00:00.000Z',
        deliveryMethod: 'LATER_CAMPUS',
        address: 'Пізніше в корпусі',
        items: [
          { title: 'Наліпка', options: '', quantity: 2, unitPrice: '50.00' },
          {
            title: 'Футболка',
            options: 'M — Білий',
            quantity: 1,
            unitPrice: '900.50',
          },
        ],
        pickupLabel: null,
        needsIndividualPickup: false,
        canChoosePickup: true,
      },
    ]);
  });

  it('shows a chosen time with an en dash and closes the choice', async () => {
    const { prisma, service } = build();
    prisma.merchOrder.findMany.mockResolvedValue([
      stored({
        pickupSlotId: 3,
        pickupSlot: {
          date: new Date('2026-11-12T00:00:00Z'),
          startTime: '12:00',
          endTime: '14:00',
        },
      }),
    ]);

    const [row] = await service.listOrders(ME);

    expect(row.pickupLabel).toBe('12.11, 12:00–14:00');
    expect(row.canChoosePickup).toBe(false);
  });

  it('offers no pickup choice for Нова Пошта', async () => {
    const { prisma, service } = build();
    prisma.merchOrder.findMany.mockResolvedValue([
      stored({ deliveryMethod: 'NOVA_POSHTA' }),
    ]);

    const [row] = await service.listOrders(ME);

    expect(row.canChoosePickup).toBe(false);
  });
});

describe('MerchOrderService pickup', () => {
  // 12:00 on 2026-11-12 in Kyiv.
  const NOW = new Date('2026-11-12T10:00:00Z');
  const ORDER = {
    id: 5,
    status: 'READY_FOR_PICKUP',
    deliveryMethod: 'LATER_CAMPUS',
    pickupSlotId: null as number | null,
    needsIndividualPickup: false,
  };
  const slot = (id: number, date: string, startTime = '15:00') => ({
    id,
    date: new Date(`${date}T00:00:00.000Z`),
    startTime,
    endTime: '16:00',
    isActive: true,
  });
  const FREE = slot(8, '2026-11-13');
  const TODAY_FREE = slot(9, '2026-11-12');
  const TODAY_BOOKED = slot(10, '2026-11-12');
  const TODAY_STARTED = slot(11, '2026-11-12', '11:00');

  function scene(order: typeof ORDER | null = ORDER) {
    const built = build();
    built.prisma.merchOrder.findFirst.mockResolvedValue(order);
    built.prisma.merchPickupSlot.findMany.mockResolvedValue([
      TODAY_FREE,
      TODAY_BOOKED,
      TODAY_STARTED,
      FREE,
    ]);
    built.prisma.merchOrder.findMany.mockResolvedValue([
      { pickupSlotId: TODAY_BOOKED.id },
      { pickupSlotId: TODAY_STARTED.id },
    ]);
    return built;
  }

  beforeEach(() => jest.useFakeTimers({ now: NOW }));
  afterEach(() => jest.useRealTimers());

  describe('pickupInfo', () => {
    it('answers 404 for an order of someone else', async () => {
      const { prisma, service } = scene(null);

      await expect(service.pickupInfo(ME, 5)).rejects.toMatchObject({
        status: 404,
        message: 'Замовлення не знайдено.',
      });
      expect(prisma.merchOrder.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 5, telegramId: 7n } }),
      );
    });

    it('lists open slots on the Kyiv clock, labelled and in order', async () => {
      const { prisma, service } = scene();

      const info = await service.pickupInfo(ME, 5);

      expect(info).toEqual({
        id: 5,
        status: 'READY_FOR_PICKUP',
        canChoose: true,
        slots: [
          {
            id: 10,
            date: '2026-11-12',
            startTime: '15:00',
            endTime: '16:00',
            label: '12.11, 15:00–16:00',
          },
          {
            id: 8,
            date: '2026-11-13',
            startTime: '15:00',
            endTime: '16:00',
            label: '13.11, 15:00–16:00',
          },
        ],
      });
      expect(prisma.merchPickupSlot.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          date: { gte: new Date('2026-11-12T00:00:00.000Z') },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      });
    });

    it('counts only non-cancelled orders as booking a slot', async () => {
      const { prisma, service } = scene();

      await service.pickupInfo(ME, 5);

      expect(prisma.merchOrder.findMany).toHaveBeenCalledWith({
        where: {
          pickupSlotId: { in: [9, 10, 11, 8] },
          status: { not: 'CANCELLED' },
        },
        select: { pickupSlotId: true },
        distinct: ['pickupSlotId'],
      });
    });

    it('gives no slots when the customer cannot choose', async () => {
      const { prisma, service } = scene({ ...ORDER, status: 'IN_PROCESS' });

      expect(await service.pickupInfo(ME, 5)).toEqual({
        id: 5,
        status: 'IN_PROCESS',
        canChoose: false,
        slots: [],
      });
      expect(prisma.merchPickupSlot.findMany).not.toHaveBeenCalled();
    });

    it('gives no slots once a time is chosen', async () => {
      const { service } = scene({ ...ORDER, pickupSlotId: 8 });

      expect(await service.pickupInfo(ME, 5)).toMatchObject({
        canChoose: false,
        slots: [],
      });
    });
  });

  describe('choosePickup', () => {
    const INDIVIDUAL = { needsIndividualPickup: true };
    const pick = (pickupSlotId: number) => ({
      pickupSlotId,
      needsIndividualPickup: false,
    });

    it('answers 404 for an order of someone else', async () => {
      const { prisma, bot, service } = scene(null);

      await expect(service.choosePickup(ME, 5, pick(8))).rejects.toMatchObject({
        status: 404,
        message: 'Замовлення не знайдено.',
      });
      expect(prisma.merchOrder.updateMany).not.toHaveBeenCalled();
      expect(bot.kick).not.toHaveBeenCalled();
    });

    it('refuses a delivery that has no pickup', async () => {
      const { prisma, service } = scene({
        ...ORDER,
        deliveryMethod: 'NOVA_POSHTA',
      });

      await expect(service.choosePickup(ME, 5, pick(8))).rejects.toMatchObject({
        status: 400,
        message: 'Для цього способу доставки час видачі не обирається.',
      });
      expect(prisma.merchOrder.updateMany).not.toHaveBeenCalled();
    });

    it('refuses an order that is not ready yet', async () => {
      const { prisma, service } = scene({ ...ORDER, status: 'IN_PROCESS' });

      await expect(service.choosePickup(ME, 5, pick(8))).rejects.toMatchObject({
        status: 409,
        message: 'Час можна обрати, коли замовлення готове до видачі.',
      });
      expect(prisma.merchOrder.updateMany).not.toHaveBeenCalled();
    });

    it('needs a slot or individual pickup', async () => {
      const { prisma, service } = scene();

      await expect(
        service.choosePickup(ME, 5, { needsIndividualPickup: false }),
      ).rejects.toMatchObject({
        status: 400,
        message: 'Оберіть час або індивідуальну видачу.',
      });
      expect(prisma.merchOrder.updateMany).not.toHaveBeenCalled();
    });

    it.each([
      ['unknown', 999],
      ['same day, unbooked', TODAY_FREE.id],
      ['already started', TODAY_STARTED.id],
    ])('refuses a slot that is %s', async (_case, id) => {
      const { prisma, service } = scene();

      await expect(service.choosePickup(ME, 5, pick(id))).rejects.toMatchObject(
        { status: 400, message: 'Цей час уже недоступний. Оберіть інший.' },
      );
      expect(prisma.merchOrder.updateMany).not.toHaveBeenCalled();
    });

    it('claims a slot and wakes the sync loop', async () => {
      const { prisma, bot, service } = scene();

      expect(await service.choosePickup(ME, 5, pick(8))).toEqual({ ok: true });

      expect(prisma.merchOrder.updateMany).toHaveBeenCalledWith({
        where: {
          id: 5,
          telegramId: 7n,
          status: 'READY_FOR_PICKUP',
          pickupSlotId: null,
          needsIndividualPickup: false,
        },
        data: {
          pickupSlotId: 8,
          needsIndividualPickup: false,
          pickupDirty: true,
        },
      });
      expect(bot.kick).toHaveBeenCalledTimes(1);
    });

    it('claims individual pickup without a slot', async () => {
      const { prisma, bot, service } = scene();

      expect(await service.choosePickup(ME, 5, INDIVIDUAL)).toEqual({
        ok: true,
      });

      expect(prisma.merchOrder.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            pickupSlotId: null,
            needsIndividualPickup: true,
            pickupDirty: true,
          },
        }),
      );
      expect(bot.kick).toHaveBeenCalledTimes(1);
    });

    it('stays silent when the same choice comes twice', async () => {
      const { prisma, bot, service } = scene({ ...ORDER, pickupSlotId: 8 });
      prisma.merchOrder.updateMany.mockResolvedValue({ count: 0 });

      expect(await service.choosePickup(ME, 5, pick(8))).toEqual({ ok: true });

      expect(bot.kick).not.toHaveBeenCalled();
    });

    it('stays silent on a repeated individual choice', async () => {
      const { prisma, bot, service } = scene({
        ...ORDER,
        needsIndividualPickup: true,
      });
      prisma.merchOrder.updateMany.mockResolvedValue({ count: 0 });

      expect(await service.choosePickup(ME, 5, INDIVIDUAL)).toEqual({
        ok: true,
      });

      expect(bot.kick).not.toHaveBeenCalled();
    });

    it('refuses to change a chosen time', async () => {
      const { prisma, bot, service } = scene({ ...ORDER, pickupSlotId: 8 });
      prisma.merchOrder.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.choosePickup(ME, 5, pick(TODAY_BOOKED.id)),
      ).rejects.toMatchObject({
        status: 409,
        message: 'Час уже обрано. Напишіть у підтримку, щоб змінити.',
      });
      expect(bot.kick).not.toHaveBeenCalled();
    });

    it('refuses individual pickup on top of a chosen time', async () => {
      const { prisma, bot, service } = scene({ ...ORDER, pickupSlotId: 8 });
      prisma.merchOrder.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.choosePickup(ME, 5, { ...pick(8), ...INDIVIDUAL }),
      ).rejects.toMatchObject({ status: 409 });
      expect(bot.kick).not.toHaveBeenCalled();
    });

    it('re-reads the row when the claim loses a race', async () => {
      const { prisma, bot, service } = scene();
      prisma.merchOrder.updateMany.mockResolvedValue({ count: 0 });
      prisma.merchOrder.findFirst
        .mockResolvedValueOnce(ORDER)
        .mockResolvedValueOnce({ ...ORDER, pickupSlotId: 8 });

      expect(await service.choosePickup(ME, 5, pick(8))).toEqual({ ok: true });
      expect(bot.kick).not.toHaveBeenCalled();
    });
  });
});
