import { NotFoundException } from '@nestjs/common';
import type { MerchDeliveryMethod, MerchOrderStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';
import { GrammyError, HttpError } from 'grammy';
import {
  addressFor,
  applyStockEdit,
  canChoosePickup,
  canTransition,
  checkLine,
  colorsOf,
  decideOrder,
  defaultColor,
  defaultSize,
  diffVariants,
  fromKopecks,
  isAvailable,
  isFreshConfirm,
  isTime,
  kyivNow,
  LineStatus,
  mergeLines,
  NO_SIZE,
  normalizePhone,
  normalizeVariants,
  oneLine,
  optionsLabel,
  optionSteps,
  parseMemberValues,
  parseOwnerIds,
  parseStart,
  parseStatusCallback,
  parseThreads,
  pickupProblem,
  priceCart,
  productAccess,
  ProductRow,
  redistribute,
  sizesOf,
  slotChatLabel,
  slotDate,
  slotDay,
  slotLabel,
  slotProblem,
  slotVisible,
  sourcesOf,
  supportTarget,
  takeStock,
  telegramFailure,
  templateProblem,
  toKopecks,
  topOrder,
  TRANSITIONS,
  VariantNow,
  variantProblem,
  VariantRow,
  viewProduct,
} from './merch-rules';
import { orderCardText, supportHeader } from './merch-texts';
import {
  CreateOrderDto,
  MerchIdPipe,
  MerchKindPipe,
  PickupDto,
  ProductDto,
  TemplateDto,
} from './merch.dto';

const cell = (
  size: string,
  color: string,
  order: number,
  stock: number | null = null,
) => ({ size, color, order, stock });

const now = (over: Partial<VariantNow> = {}): VariantNow => ({
  id: 1,
  productId: 10,
  title: 'Футболка',
  isActive: true,
  groupIds: [],
  size: 'M',
  color: 'Білий',
  price: '500.00',
  stock: 5,
  ...over,
});

describe('money', () => {
  it.each<[string, number]>([
    ['0.07', 7],
    ['0.29', 29],
    ['1.10', 110],
    ['19.99', 1999],
    ['1.15', 115],
    ['1000', 100000],
  ])('toKopecks(%s) is %d, with no float drift', (value, kopecks) => {
    expect(toKopecks(value)).toBe(kopecks);
  });

  it('takes numbers and Decimal-like values', () => {
    expect(toKopecks(0.07)).toBe(7);
    expect(toKopecks({ toString: () => '12.34' })).toBe(1234);
  });

  it('comes back as a string with 2 decimals', () => {
    expect(fromKopecks(7)).toBe('0.07');
    expect(fromKopecks(100000)).toBe('1000.00');
    expect(fromKopecks(toKopecks('0.07') * 3)).toBe('0.21');
  });
});

describe('matrix axes', () => {
  it('keeps both axes when the first cell of the matrix is missing', () => {
    const rows = [
      cell('M', 'Чорний', 101),
      cell('M', 'Білий', 100),
      cell('S', 'Чорний', 1),
    ];
    expect(sizesOf(rows)).toEqual(['S', 'M']);
    expect(colorsOf(rows)).toEqual(['Білий', 'Чорний']);
  });

  it('leaves the empty colour out of colorsOf', () => {
    expect(colorsOf([cell('S', '', 0), cell('M', '', 100)])).toEqual([]);
  });
});

describe('defaultColor', () => {
  it('skips a sold out colour', () => {
    expect(
      defaultColor([cell('M', 'Білий', 0, 0), cell('M', 'Чорний', 1, 3)]),
    ).toBe('Чорний');
  });

  it('never assumes Білий', () => {
    expect(
      defaultColor([cell('M', 'Синій', 0, 2), cell('M', 'Білий', 1, 2)]),
    ).toBe('Синій');
  });

  it('counts unlimited stock as something to sell', () => {
    expect(
      defaultColor([cell('M', 'Білий', 0, 0), cell('M', 'Чорний', 1, null)]),
    ).toBe('Чорний');
  });

  it('falls back to the first colour, then to nothing', () => {
    expect(
      defaultColor([cell('M', 'Чорний', 1, 0), cell('M', 'Білий', 0, 0)]),
    ).toBe('Білий');
    expect(defaultColor([cell('M', '', 0, 1)])).toBe('');
  });
});

describe('defaultSize', () => {
  const rows = [
    cell('S', 'Білий', 0, 0),
    cell('M', 'Білий', 100, 2),
    cell('L', 'Чорний', 201, 0),
    cell('XL', 'Чорний', 301, 0),
  ];

  it('picks the first size with stock in that colour', () => {
    expect(defaultSize(rows, 'Білий')).toBe('M');
  });

  it('falls back to the first size of the colour, then to nothing', () => {
    expect(defaultSize(rows, 'Чорний')).toBe('L');
    expect(defaultSize(rows, 'Синій')).toBe('');
  });
});

describe('optionSteps', () => {
  it.each([
    [
      'no size',
      [cell(NO_SIZE, '', 0)],
      { colors: [], sizes: [], fixedSize: null },
    ],
    [
      'colours without sizes',
      [cell(NO_SIZE, 'Білий', 0), cell(NO_SIZE, 'Чорний', 1)],
      { colors: ['Білий', 'Чорний'], sizes: [], fixedSize: null },
    ],
    [
      'single real size',
      [cell('M', '', 0)],
      { colors: [], sizes: [], fixedSize: 'M' },
    ],
    [
      'single size in one colour',
      [cell('M', 'Білий', 0)],
      { colors: ['Білий'], sizes: ['M'], fixedSize: null },
    ],
    [
      'sizes without colours',
      [cell('S', '', 0), cell('M', '', 100)],
      { colors: [], sizes: ['S', 'M'], fixedSize: null },
    ],
    [
      'no size next to a real size',
      [cell(NO_SIZE, '', 0), cell('M', '', 100)],
      { colors: [], sizes: [NO_SIZE, 'M'], fixedSize: null },
    ],
    [
      'normal matrix',
      [
        cell('S', 'Білий', 0),
        cell('S', 'Чорний', 1),
        cell('M', 'Білий', 100),
        cell('M', 'Чорний', 101),
      ],
      { colors: ['Білий', 'Чорний'], sizes: ['S', 'M'], fixedSize: null },
    ],
  ])('%s', (_name, rows, steps) => {
    expect(optionSteps(rows)).toEqual(steps);
  });
});

describe('optionsLabel', () => {
  it('never prints the no-size value', () => {
    expect(optionsLabel(NO_SIZE, '')).toBe('');
    expect(optionsLabel(NO_SIZE, 'Білий')).toBe('Білий');
  });

  it('joins what exists', () => {
    expect(optionsLabel('M', '')).toBe('M');
    expect(optionsLabel('M', 'Білий')).toBe('M — Білий');
    expect(optionsLabel('M', 'Білий', ' | ')).toBe('M | Білий');
  });
});

describe('oneLine', () => {
  it('folds every run of whitespace', () => {
    expect(oneLine('  Тарас \n\n  Вигаданий\t ')).toBe('Тарас Вигаданий');
  });
});

describe('productAccess', () => {
  it.each<[boolean, number[], number[], string]>([
    [true, [], [], 'ok'],
    [false, [], [], 'archived'],
    [true, [1], [], 'hidden'],
    [true, [1, 2], [2], 'ok'],
    [false, [1], [2], 'hidden'],
    [false, [1], [1], 'archived'],
  ])(
    'active %s, groups %j, viewer %j: %s',
    (isActive, groupIds, viewer, want) => {
      expect(productAccess({ isActive, groupIds }, viewer)).toBe(want);
    },
  );
});

describe('viewProduct', () => {
  const photo = {
    color: 'Чорний',
    url: '/uploads/full.jpg',
    thumbUrl: '/uploads/thumb.jpg',
  };
  const row = (over: Partial<ProductRow> = {}): ProductRow => ({
    id: 5,
    title: 'Футболка',
    description: 'Бавовна',
    isActive: true,
    categoryId: 2,
    tagIds: [3],
    groupIds: [],
    variants: [
      { id: 1, size: 'S', color: 'Білий', price: '100.00', stock: 0, order: 0 },
      {
        id: 2,
        size: 'S',
        color: 'Чорний',
        price: '650.00',
        stock: 4,
        order: 1,
      },
      {
        id: 3,
        size: 'M',
        color: 'Чорний',
        price: '800.00',
        stock: null,
        order: 101,
      },
    ],
    photos: [photo],
    ...over,
  });

  it('hides a restricted product from outsiders only', () => {
    expect(viewProduct(row({ groupIds: [9] }), [], 'bot')).toBeNull();
    expect(viewProduct(row({ groupIds: [9] }), [8], 'bot')).toBeNull();
    expect(viewProduct(row({ groupIds: [9] }), [9], 'bot')).not.toBeNull();
  });

  it('strips an archived product of everything buyable and keeps its photos', () => {
    expect(viewProduct(row({ isActive: false }), [], null)).toMatchObject({
      archived: true,
      variants: [],
      colors: [],
      sizes: [],
      fixedSize: null,
      minPrice: null,
      photos: [photo],
      botUsername: null,
    });
  });

  it('gives the whole view, with no order field in variants', () => {
    expect(viewProduct(row(), [], 'merch_test_bot')).toStrictEqual({
      id: 5,
      title: 'Футболка',
      description: 'Бавовна',
      archived: false,
      categoryId: 2,
      tagIds: [3],
      colors: ['Білий', 'Чорний'],
      sizes: ['S', 'M'],
      fixedSize: null,
      defaultColor: 'Чорний',
      minPrice: '650.00',
      variants: [
        { id: 1, size: 'S', color: 'Білий', price: '100.00', stock: 0 },
        { id: 2, size: 'S', color: 'Чорний', price: '650.00', stock: 4 },
        { id: 3, size: 'M', color: 'Чорний', price: '800.00', stock: null },
      ],
      photos: [photo],
      botUsername: 'merch_test_bot',
    });
  });

  it('prices a sold out product at the lowest of all', () => {
    const variants = row().variants.map((v) => ({ ...v, stock: 0 }));
    expect(viewProduct(row({ variants }), [], null)?.minPrice).toBe('100.00');
  });
});

describe('checkLine', () => {
  it.each<[string, VariantNow | undefined, number, LineStatus, number]>([
    ['no variant', undefined, 1, 'gone', 0],
    ['hidden from the viewer', now({ groupIds: [7] }), 1, 'gone', 0],
    ['archived', now({ isActive: false }), 1, 'archived', 0],
    [
      'archived and sold out',
      now({ isActive: false, stock: 0 }),
      1,
      'archived',
      0,
    ],
    ['sold out', now({ stock: 0 }), 1, 'soldout', 0],
    ['short', now({ stock: 2 }), 3, 'short', 2],
    ['exactly enough', now({ stock: 2 }), 2, 'ok', 2],
    ['stock above the cap', now({ stock: 500 }), 99, 'ok', 99],
    ['more than the cap', now({ stock: 500 }), 100, 'short', 99],
    ['unlimited', now({ stock: null }), 99, 'ok', 99],
    ['unlimited above the cap', now({ stock: null }), 100, 'short', 99],
  ])('%s', (_name, variant, quantity, status, maxQuantity) => {
    expect(checkLine(quantity, variant, [])).toEqual({ status, maxQuantity });
  });

  it('serves a group member', () => {
    expect(checkLine(1, now({ groupIds: [7] }), [7]).status).toBe('ok');
  });
});

describe('priceCart', () => {
  const live = (over: Partial<VariantNow> = {}) => ({
    ...now(over),
    thumbUrl: '/uploads/thumb.jpg',
  });
  const gone = (variantId: number, quantity: number) => ({
    variantId,
    productId: null,
    title: null,
    size: null,
    color: '',
    options: '',
    thumbUrl: null,
    unitPrice: null,
    lineTotal: '0.00',
    quantity,
    maxQuantity: 0,
    status: 'gone',
  });

  it('gives a hidden and a missing variant the same exact object', () => {
    const { lines } = priceCart(
      [
        { variantId: 2, quantity: 1 },
        { variantId: 3, quantity: 4 },
      ],
      [live({ id: 2, groupIds: [7], title: 'Куратор' })],
      [],
    );
    expect(lines[0]).toStrictEqual(gone(2, 1));
    expect(lines[1]).toStrictEqual(gone(3, 4));
  });

  it('charges every line that is not gone, as decideOrder does', () => {
    const preview = priceCart(
      [
        { variantId: 1, quantity: 2 },
        { variantId: 2, quantity: 3 },
        { variantId: 3, quantity: 1 },
        { variantId: 4, quantity: 1 },
      ],
      [
        live({ id: 1 }),
        live({ id: 2, stock: 1, price: '250.50' }),
        live({ id: 3, stock: 0 }),
        live({ id: 4, isActive: false }),
      ],
      [],
    );
    expect(preview.total).toBe('2751.50');
    expect(preview.hasProblems).toBe(true);
    expect(
      preview.lines.map((l) => [l.status, l.lineTotal, l.maxQuantity]),
    ).toEqual([
      ['ok', '1000.00', 5],
      ['short', '751.50', 1],
      ['soldout', '500.00', 0],
      ['archived', '500.00', 0],
    ]);
    expect(preview.lines[1].quantity).toBe(3);
    expect(preview.lines[2].unitPrice).toBe('500.00');

    const order = decideOrder(
      preview.lines.map(({ variantId, quantity }) => ({
        variantId,
        quantity,
        label: 'x',
      })),
      new Map(
        [
          live({ id: 1 }),
          live({ id: 2, stock: 1, price: '250.50' }),
          live({ id: 3, stock: 0 }),
          live({ id: 4, isActive: false }),
        ].map((v) => [v.id, v]),
      ),
      [],
      toKopecks(preview.total),
    );
    expect(fromKopecks(order.totalKopecks)).toBe(preview.total);
    expect(order.warnings.join()).not.toContain('Сума не збігається');
  });

  it('hides the no-size value and reports a clean cart', () => {
    const preview = priceCart(
      [{ variantId: 1, quantity: 1 }],
      [live({ size: NO_SIZE, color: '' })],
      [],
    );
    expect(preview.lines[0]).toMatchObject({ size: null, options: '' });
    expect(preview.hasProblems).toBe(false);
  });
});

describe('takeStock', () => {
  it.each<[number | null, number, object]>([
    [5, 2, { left: 3, taken: 2, short: 0 }],
    [2, 2, { left: 0, taken: 2, short: 0 }],
    [1, 3, { left: 0, taken: 1, short: 2 }],
    [0, 2, { left: 0, taken: 0, short: 2 }],
    [null, 9, { left: null, taken: 0, short: 0 }],
  ])('stock %s, quantity %d', (stock, quantity, result) => {
    expect(takeStock(stock, quantity)).toEqual(result);
  });
});

describe('mergeLines', () => {
  it('keeps the first line and sums the quantities', () => {
    expect(
      mergeLines([
        { variantId: 1, quantity: 2, label: 'перша' },
        { variantId: 2, quantity: 1, label: 'друга' },
        { variantId: 1, quantity: 3, label: 'третя' },
      ]),
    ).toEqual([
      { variantId: 1, quantity: 5, label: 'перша' },
      { variantId: 2, quantity: 1, label: 'друга' },
    ]);
  });

  it('caps the sum', () => {
    expect(
      mergeLines([
        { variantId: 1, quantity: 60 },
        { variantId: 1, quantity: 60 },
      ]),
    ).toEqual([{ variantId: 1, quantity: 99 }]);
  });
});

describe('decideOrder', () => {
  const line = { variantId: 1, quantity: 2, label: 'Футболка M' };
  const decide = (
    variants: VariantNow[],
    expected: number,
    groups = [] as number[],
  ) =>
    decideOrder(
      [line],
      new Map(variants.map((v) => [v.id, v])),
      groups,
      expected,
    );

  it('takes an ordinary line with no warning', () => {
    expect(decide([now()], 100000)).toEqual({
      items: [
        {
          variantId: 1,
          productId: 10,
          title: 'Футболка',
          size: 'M',
          color: 'Білий',
          unitKopecks: 50000,
          quantity: 2,
          stockTaken: 2,
        },
      ],
      stock: [{ id: 1, left: 3 }],
      totalKopecks: 100000,
      warnings: [],
    });
  });

  it('leaves a gone variant out and warns with what the customer saw', () => {
    expect(decide([], 0)).toEqual({
      items: [],
      stock: [],
      totalKopecks: 0,
      warnings: ['⚠️ Позицію видалено: Футболка M × 2. Ціну не перевірено.'],
    });
  });

  it('adds no item, no stock entry and no price for a hidden line', () => {
    expect(decide([now({ groupIds: [7] })], 0)).toEqual({
      items: [],
      stock: [],
      totalKopecks: 0,
      warnings: ['⚠️ Товар не для цього покупця: Футболка × 2'],
    });
  });

  it('keeps an archived line, takes its stock and warns', () => {
    const decision = decide([now({ isActive: false })], 100000);
    expect(decision.items).toHaveLength(1);
    expect(decision.stock).toEqual([{ id: 1, left: 3 }]);
    expect(decision.warnings).toEqual(['⚠️ Товар уже в архіві: Футболка']);
  });

  it('warns twice about an archived line that is also short', () => {
    const decision = decide([now({ isActive: false, stock: 1 })], 100000);
    expect(decision.items[0]).toMatchObject({ quantity: 2, stockTaken: 1 });
    expect(decision.warnings).toEqual([
      '⚠️ Товар уже в архіві: Футболка',
      '⚠️ Не вистачило: Футболка M — Білий: замовлено 2, було 1',
    ]);
  });

  it('takes a short line in full, floors the stock at 0 and warns', () => {
    const decision = decide([now({ stock: 1 })], 100000);
    expect(decision.items[0]).toMatchObject({ quantity: 2, stockTaken: 1 });
    expect(decision.stock).toEqual([{ id: 1, left: 0 }]);
    expect(decision.totalKopecks).toBe(100000);
    expect(decision.warnings).toEqual([
      '⚠️ Не вистачило: Футболка M — Білий: замовлено 2, було 1',
    ]);
  });

  it('writes a sold out line off without touching the stock', () => {
    const decision = decide([now({ stock: 0 })], 100000);
    expect(decision.items[0].stockTaken).toBe(0);
    expect(decision.stock).toEqual([]);
    expect(decision.warnings).toHaveLength(1);
  });

  it('prints no gap for a short line without options', () => {
    const decision = decide(
      [now({ stock: 1, size: NO_SIZE, color: '' })],
      100000,
    );
    expect(decision.warnings).toEqual([
      '⚠️ Не вистачило: Футболка: замовлено 2, було 1',
    ]);
  });

  it('takes nothing from unlimited stock', () => {
    const decision = decide([now({ stock: null })], 100000);
    expect(decision.items[0].stockTaken).toBe(0);
    expect(decision.stock).toEqual([]);
    expect(decision.warnings).toEqual([]);
  });

  it('cuts the label to 120 characters', () => {
    const decision = decideOrder(
      [{ variantId: 9, quantity: 1, label: 'я'.repeat(300) }],
      new Map(),
      [],
      0,
    );
    expect(decision.warnings).toEqual([
      `⚠️ Позицію видалено: ${'я'.repeat(120)} × 1. Ціну не перевірено.`,
    ]);
  });

  it('keeps the server total and warns when the client saw another one', () => {
    const decision = decide([now()], 90000);
    expect(decision.totalKopecks).toBe(100000);
    expect(decision.warnings).toEqual([
      '⚠️ Сума не збігається: клієнт бачив 900.00, сервер порахував 1000.00 грн',
    ]);
  });

  it('never throws when every line is gone', () => {
    const decision = decide([], 100000);
    expect(decision.items).toEqual([]);
    expect(decision.totalKopecks).toBe(0);
    expect(decision.warnings).toEqual([
      '⚠️ Позицію видалено: Футболка M × 2. Ціну не перевірено.',
      '⚠️ Сума не збігається: клієнт бачив 1000.00, сервер порахував 0.00 грн',
    ]);
  });

  it('serves a group member', () => {
    expect(decide([now({ groupIds: [7] })], 100000, [7]).warnings).toEqual([]);
  });
});

describe('status transitions', () => {
  const STATUSES: MerchOrderStatus[] = [
    'PENDING',
    'IN_PROCESS',
    'READY_FOR_PICKUP',
    'COMPLETED',
    'CANCELLED',
  ];
  // Rows are the current status, columns the status asked for, in STATUSES order.
  const TABLE: Record<MerchOrderStatus, number[]> = {
    PENDING: [0, 1, 0, 0, 1],
    IN_PROCESS: [0, 0, 1, 1, 1],
    READY_FOR_PICKUP: [0, 0, 0, 1, 1],
    COMPLETED: [0, 0, 0, 0, 0],
    CANCELLED: [0, 0, 0, 0, 0],
  };

  it.each(
    STATUSES.flatMap((from) =>
      STATUSES.map((to, i) => [from, to, TABLE[from][i] === 1] as const),
    ),
  )('%s to %s: %s', (from, to, allowed) => {
    expect(canTransition(from, to)).toBe(allowed);
    expect(TRANSITIONS[from].includes(to)).toBe(allowed);
    expect(sourcesOf(to).includes(from)).toBe(allowed);
  });

  it('lists the sources of each status for the CAS', () => {
    expect(sourcesOf('PENDING')).toEqual([]);
    expect(sourcesOf('IN_PROCESS')).toEqual(['PENDING']);
    expect(sourcesOf('READY_FOR_PICKUP')).toEqual(['IN_PROCESS']);
    expect(sourcesOf('COMPLETED')).toEqual(['IN_PROCESS', 'READY_FOR_PICKUP']);
    expect(sourcesOf('CANCELLED')).toEqual([
      'PENDING',
      'IN_PROCESS',
      'READY_FOR_PICKUP',
    ]);
  });
});

describe('parseStatusCallback', () => {
  it('reads the old button format', () => {
    expect(parseStatusCallback('ostatus:123:in_process')).toEqual({
      orderId: 123,
      status: 'IN_PROCESS',
    });
    expect(parseStatusCallback('ostatus:7:ready_for_pickup')).toEqual({
      orderId: 7,
      status: 'READY_FOR_PICKUP',
    });
  });

  it.each([
    '',
    'ignore',
    'ostatus:123',
    'ostatus:abc:completed',
    'ostatus:0:completed',
    'ostatus:-1:completed',
    'ostatus:1234567890:completed',
    'ostatus:1:shipped',
    'ostatus:1:COMPLETED',
    'ostatus:1:completed:more',
    'ostatus:1:constructor',
    'ostatus:1:__proto__',
    'xstatus:1:completed',
  ])('rejects %j', (data) => {
    expect(parseStatusCallback(data)).toBeNull();
  });
});

describe('pickup rules', () => {
  const pickup = (
    deliveryMethod: MerchDeliveryMethod | null,
    status: MerchOrderStatus,
    chosen: { pickupSlotId?: number; needsIndividualPickup?: boolean } = {},
  ) => ({
    deliveryMethod,
    status,
    pickupSlotId: chosen.pickupSlotId ?? null,
    needsIndividualPickup: chosen.needsIndividualPickup ?? false,
  });

  it('allows the pickup methods once the order is ready', () => {
    for (const method of ['CAMPUS', 'DAYF', 'LATER_CAMPUS'] as const) {
      expect(pickupProblem(pickup(method, 'READY_FOR_PICKUP'))).toBeNull();
    }
  });

  it('names what is wrong', () => {
    expect(pickupProblem(pickup('NOVA_POSHTA', 'READY_FOR_PICKUP'))).toBe(
      'delivery',
    );
    expect(pickupProblem(pickup(null, 'READY_FOR_PICKUP'))).toBe('delivery');
    expect(pickupProblem(pickup('DAYF', 'IN_PROCESS'))).toBe('status');
    expect(pickupProblem(pickup('DAYF', 'COMPLETED'))).toBe('status');
  });

  it('treats a chosen time as final', () => {
    expect(canChoosePickup(pickup('DAYF', 'READY_FOR_PICKUP'))).toBe(true);
    expect(
      canChoosePickup(pickup('DAYF', 'READY_FOR_PICKUP', { pickupSlotId: 3 })),
    ).toBe(false);
    expect(
      canChoosePickup(
        pickup('DAYF', 'READY_FOR_PICKUP', { needsIndividualPickup: true }),
      ),
    ).toBe(false);
    expect(canChoosePickup(pickup('NOVA_POSHTA', 'READY_FOR_PICKUP'))).toBe(
      false,
    );
    expect(canChoosePickup(pickup('DAYF', 'IN_PROCESS'))).toBe(false);
  });
});

describe('addressFor', () => {
  it('trims a typed address and fills in the others', () => {
    expect(addressFor('NOVA_POSHTA', '  Київ, відділення 5 ')).toBe(
      'Київ, відділення 5',
    );
    expect(addressFor('NOVA_POSHTA')).toBe('');
    expect(addressFor('LATER_CAMPUS', 'зайве')).toBe('Пізніше в корпусі');
    expect(addressFor('DAYF')).toBe('На DayF');
    expect(addressFor('CAMPUS')).toBe('На DayF');
  });
});

describe('slotVisible', () => {
  const NOON = { date: '2026-11-12', time: '12:00' };
  const slot = (over = {}) => ({
    id: 1,
    date: '2026-11-12',
    startTime: '14:00',
    isActive: true,
    ...over,
  });
  const free = new Set<number>();
  const booked = new Set([1]);

  it('hides past days', () => {
    expect(slotVisible(slot({ date: '2026-11-11' }), NOON, booked)).toBe(false);
  });

  it('shows future days', () => {
    expect(slotVisible(slot({ date: '2026-11-13' }), NOON, free)).toBe(true);
  });

  it('shows today only when the slot is already in use', () => {
    expect(slotVisible(slot(), NOON, booked)).toBe(true);
    expect(slotVisible(slot(), NOON, free)).toBe(false);
  });

  it('hides a slot that has started', () => {
    expect(slotVisible(slot({ startTime: '11:59' }), NOON, booked)).toBe(false);
    expect(slotVisible(slot({ startTime: '12:00' }), NOON, booked)).toBe(true);
  });

  it('hides an inactive slot', () => {
    const inactive = slot({ date: '2026-11-13', isActive: false });
    expect(slotVisible(inactive, NOON, booked)).toBe(false);
  });

  it('uses the Kyiv day around midnight, not the UTC one', () => {
    // 00:30 on the 12th in Kyiv, still the 11th in UTC.
    const night = kyivNow(new Date('2026-11-11T22:30:00Z'));
    expect(night).toEqual({ date: '2026-11-12', time: '00:30' });
    expect(slotVisible(slot({ date: '2026-11-11' }), night, booked)).toBe(
      false,
    );
    expect(slotVisible(slot(), night, free)).toBe(false);
    expect(slotVisible(slot({ date: '2026-11-13' }), night, free)).toBe(true);
  });

  it('follows the clock change on a DST day', () => {
    const start = slot({ date: '2026-03-29', startTime: '04:00' });
    // 03:00 does not exist that morning: the clock jumps from 02:59 to 04:00.
    const before = kyivNow(new Date('2026-03-29T00:59:00Z'));
    const after = kyivNow(new Date('2026-03-29T01:30:00Z'));
    expect(before).toEqual({ date: '2026-03-29', time: '02:59' });
    expect(after).toEqual({ date: '2026-03-29', time: '04:30' });
    expect(slotVisible(start, before, booked)).toBe(true);
    expect(slotVisible(start, after, booked)).toBe(false);
  });

  it('follows the clock going back in autumn', () => {
    expect(kyivNow(new Date('2026-10-25T00:30:00Z')).time).toBe('03:30');
    expect(kyivNow(new Date('2026-10-25T01:30:00Z')).time).toBe('03:30');
  });
});

describe('slot dates and labels', () => {
  it('round trips a day through the DateTime column', () => {
    expect(slotDate('2026-11-12').toISOString()).toBe(
      '2026-11-12T00:00:00.000Z',
    );
    expect(slotDay(slotDate('2026-11-12'))).toBe('2026-11-12');
  });

  const slot = { date: '2026-11-12', startTime: '12:00', endTime: '14:00' };

  it('labels a slot for the profile, with an en dash', () => {
    expect(slotLabel(slot)).toBe('12.11, 12:00–14:00');
  });

  it('labels a slot for chat texts', () => {
    expect(slotChatLabel(slot)).toBe('2026-11-12 12:00-14:00');
  });
});

describe('slotProblem', () => {
  it.each<[string, string, string, string | null]>([
    ['2026-11-12', '12:00', '14:00', null],
    ['2028-02-29', '00:00', '23:59', null],
    ['2026-02-30', '12:00', '14:00', 'Некоректна дата або час.'],
    ['2027-02-29', '12:00', '14:00', 'Некоректна дата або час.'],
    ['2026-13-01', '12:00', '14:00', 'Некоректна дата або час.'],
    ['2026-11-12', '24:00', '25:00', 'Некоректна дата або час.'],
    ['2026-11-12', '12:00', '12:60', 'Некоректна дата або час.'],
    ['2026-11-12', '14:00', '12:00', 'Кінець має бути пізніше за початок.'],
    ['2026-11-12', '12:00', '12:00', 'Кінець має бути пізніше за початок.'],
  ])('%s %s %s', (date, start, end, problem) => {
    expect(slotProblem(date, start, end)).toBe(problem);
  });

  it('reads times the way the import does', () => {
    expect(isTime('23:59')).toBe(true);
    expect(isTime('9:00')).toBe(false);
    expect(isTime('banana')).toBe(false);
  });
});

describe('normalizePhone', () => {
  it.each([
    ['+380501112233', '+380501112233'],
    ['380501112233', '+380501112233'],
    ['0501112233', '+380501112233'],
    ['+38 (050) 111-22-33', '+380501112233'],
    ['(050) 111.22.33', '+380501112233'],
  ])('%s', (raw, phone) => {
    expect(normalizePhone(raw)).toBe(phone);
  });

  it.each(['', '123', '050111223', '05011122334', '+12025550100', 'телефон'])(
    'refuses %j',
    (raw) => {
      expect(normalizePhone(raw)).toBeNull();
    },
  );
});

describe('variants on save', () => {
  const row = (over: Partial<VariantRow> = {}): VariantRow => ({
    size: 'M',
    color: '',
    price: '500.00',
    order: 0,
    ...over,
  });

  it('trims and uppercases sizes, keeps the no-size value and other fields', () => {
    expect(
      normalizeVariants([
        row({ size: ' xl ', color: ' Білий ', stock: 3, stockSeen: 2 }),
        row({ size: ` ${NO_SIZE} ` }),
      ]),
    ).toEqual([
      row({ size: 'XL', color: 'Білий', stock: 3, stockSeen: 2 }),
      row({ size: NO_SIZE }),
    ]);
  });

  it.each<[string, VariantRow[], string | null]>([
    ['a good row', [row()], null],
    ['an unlimited row', [row({ stock: null })], null],
    [
      'a colour in two sizes',
      [row({ color: 'a' }), row({ size: 'L', color: 'a' })],
      null,
    ],
    ['an empty list', [], 'Додайте хоча б один варіант'],
    [
      'an empty size',
      [row({ size: '' })],
      'Назва розміру не може бути порожньою',
    ],
    [
      'no size next to a real size',
      [row(), row({ size: NO_SIZE, color: 'a' })],
      'Розмір «-» не можна поєднувати з іншими розмірами',
    ],
    ['a zero price', [row({ price: '0.00' })], 'Некоректна ціна для розміру M'],
    ['a junk price', [row({ price: 'abc' })], 'Некоректна ціна для розміру M'],
    [
      'a zero price without a size',
      [row({ size: NO_SIZE, price: '0' })],
      'Некоректна ціна для розміру без розміру',
    ],
    [
      'negative stock',
      [row({ stock: -1 })],
      'Некоректна кількість для розміру M',
    ],
    [
      'fractional stock',
      [row({ stock: 1.5 })],
      'Некоректна кількість для розміру M',
    ],
    ['a duplicate', [row(), row({ order: 1 })], 'Розмір M повторюється'],
    [
      'a duplicate with a colour',
      [row({ color: 'Білий' }), row({ color: 'Білий' })],
      'Розмір M Білий повторюється',
    ],
  ])('%s', (_name, rows, problem) => {
    expect(variantProblem(rows)).toBe(problem);
  });

  it('reports problems in check order, not row order', () => {
    expect(
      variantProblem([
        row({ size: 'L' }),
        row({ size: 'L' }),
        row({ stock: -1 }),
        row({ price: '0' }),
      ]),
    ).toBe('Некоректна ціна для розміру M');
  });
});

describe('applyStockEdit', () => {
  it.each<[string, number | null, number | null, number | null, number | null]>(
    [
      ['title fixed, 3 sold meanwhile', 7, 10, 10, 7],
      ['admin added 5, 3 sold', 7, 10, 15, 12],
      ['two admins, both from 10 to 15', 15, 10, 15, 20],
      [
        'counted 3 damaged while 3 sold: lands on the current number',
        7,
        10,
        7,
        4,
      ],
      ['admin zeroed it, floor holds', 1, 10, 0, 0],
      ['switched to no limit', 7, 10, null, null],
      ['limit set', null, null, 5, 5],
      ['untouched field, someone removed the limit', null, 5, 5, null],
      ['untouched field, someone set a limit', 5, null, null, 5],
      ['limit set, someone set another first', 3, null, 5, 5],
      ['limit changed, someone removed it first', null, 5, 8, 8],
    ],
  )('%s', (_story, current, seen, wanted, result) => {
    expect(applyStockEdit(current, seen, wanted)).toBe(result);
  });

  it('treats a missing seen as what is stored now', () => {
    expect(applyStockEdit(7, undefined, 7)).toBe(7);
    expect(applyStockEdit(7, undefined, 9)).toBe(9);
  });

  it('treats a missing wanted as no limit', () => {
    expect(applyStockEdit(7, 7, undefined)).toBeNull();
  });
});

describe('diffVariants', () => {
  it('updates matched rows in place, creates new ones and removes the rest', () => {
    const existing = [
      { id: 1, size: 'M', color: 'Білий', stock: 7 },
      { id: 2, size: 'L', color: 'Білий', stock: null },
      { id: 3, size: 'S', color: 'Білий', stock: 0 },
    ];
    const diff = diffVariants(existing, [
      {
        size: 'M',
        color: 'Білий',
        price: '600.00',
        order: 100,
        stock: 15,
        stockSeen: 10,
      },
      { size: 'L', color: 'Білий', price: '600.00', order: 200, stock: null },
      { size: 'XL', color: 'Білий', price: '650.00', order: 300, stock: 4 },
      { size: 'XXL', color: 'Білий', price: '650.00', order: 400 },
    ]);
    expect(diff).toEqual({
      update: [
        { id: 1, price: '600.00', stock: 12, order: 100 },
        { id: 2, price: '600.00', stock: null, order: 200 },
      ],
      create: [
        { size: 'XL', color: 'Білий', price: '650.00', stock: 4, order: 300 },
        {
          size: 'XXL',
          color: 'Білий',
          price: '650.00',
          stock: null,
          order: 400,
        },
      ],
      remove: [3],
    });
  });

  it('tells colours apart', () => {
    const diff = diffVariants(
      [{ id: 1, size: 'M', color: 'Білий', stock: 1 }],
      [{ size: 'M', color: 'Чорний', price: '1.00', order: 0 }],
    );
    expect(diff.update).toEqual([]);
    expect(diff.create).toHaveLength(1);
    expect(diff.remove).toEqual([1]);
  });
});

describe('order values', () => {
  it('puts a new product first', () => {
    expect(topOrder(null)).toBe(0);
    expect(topOrder(5)).toBe(4);
    expect(topOrder(-3)).toBe(-4);
  });

  const rows = [
    { id: 1, order: 10 },
    { id: 2, order: 20 },
    { id: 3, order: 30 },
    { id: 4, order: 40 },
  ];

  it('hands the values of a subset to its ids, so hidden rows keep theirs', () => {
    expect(
      redistribute(
        [3, 1],
        rows.filter((r) => r.id === 1 || r.id === 3),
      ),
    ).toEqual([
      { id: 3, order: 10 },
      { id: 1, order: 30 },
    ]);
  });

  it('returns only the rows that change', () => {
    expect(redistribute([1, 3, 2, 4], rows)).toEqual([
      { id: 3, order: 20 },
      { id: 2, order: 30 },
    ]);
    expect(redistribute([1, 2, 3, 4], rows)).toEqual([]);
  });

  it('breaks ties, so swapping tied rows does something', () => {
    expect(
      redistribute(
        [2, 1],
        [
          { id: 1, order: -1 },
          { id: 2, order: -1 },
        ],
      ),
    ).toEqual([{ id: 1, order: 0 }]);
  });

  it('drops a stale id', () => {
    expect(redistribute([9, 2, 1], rows.slice(0, 2))).toEqual([
      { id: 2, order: 10 },
      { id: 1, order: 20 },
    ]);
  });
});

describe('parseMemberValues', () => {
  it('adds ids and usernames, dedupes and reports what it refused', () => {
    expect(parseMemberValues('26, @Good_User; bad-name 123 123 ab')).toEqual({
      members: [
        { telegramId: 26n },
        { username: 'good_user' },
        { telegramId: 123n },
      ],
      refused: ['bad-name', 'ab'],
    });
  });

  it('keeps ids inside BIGINT', () => {
    const { members, refused } = parseMemberValues(
      '9223372036854775807 9223372036854775808 123456789012345678901',
    );
    expect(members).toEqual([{ telegramId: 9223372036854775807n }]);
    expect(refused).toEqual(['9223372036854775808', '123456789012345678901']);
  });

  it('dedupes a username across case and @', () => {
    expect(parseMemberValues('@Good_User good_user').members).toEqual([
      { username: 'good_user' },
    ]);
  });

  it('gives nothing for blank input', () => {
    expect(parseMemberValues(' \n,; ')).toEqual({ members: [], refused: [] });
  });
});

describe('templateProblem', () => {
  const price = (size: string, color: string, value = '100') => ({
    size,
    color,
    price: value,
  });

  it.each<
    [string, string[], string[], ReturnType<typeof price>[], string | null]
  >([
    ['a good template', ['M'], ['Білий'], [price('M', 'Білий')], null],
    ['no colours', ['M'], [], [price('M', '')], null],
    ['a pair not sold', ['M', 'L'], ['a', 'b'], [price('M', 'a')], null],
    ['no prices', ['M'], [], [], 'Вкажіть хоча б одну ціну'],
    [
      'an unknown size',
      ['M'],
      [],
      [price('L', '')],
      'Ціна для варіанта, якого немає в шаблоні',
    ],
    [
      'an unknown colour',
      ['M'],
      ['Білий'],
      [price('M', 'Чорний')],
      'Ціна для варіанта, якого немає в шаблоні',
    ],
    [
      'a colour on a template without colours',
      ['M'],
      [],
      [price('M', 'Білий')],
      'Ціна для варіанта, якого немає в шаблоні',
    ],
    [
      'no colour on a template with colours',
      ['M'],
      ['Білий'],
      [price('M', '')],
      'Ціна для варіанта, якого немає в шаблоні',
    ],
    [
      'a zero price',
      ['M'],
      [],
      [price('M', '', '0')],
      'Некоректна ціна для розміру M',
    ],
    [
      'a zero price without a size',
      [NO_SIZE],
      [],
      [price(NO_SIZE, '', '0.00')],
      'Некоректна ціна для розміру без розміру',
    ],
  ])('%s', (_name, sizes, colors, prices, problem) => {
    expect(templateProblem({ sizes, colors, prices })).toBe(problem);
  });
});

describe('parseThreads', () => {
  it('reads both threads', () => {
    expect(parseThreads('orders:633 support:629')).toEqual({
      orders: 633,
      support: 629,
    });
  });

  it('treats 0 as clearing a thread', () => {
    expect(parseThreads('orders:0')).toEqual({ orders: null });
  });

  it('gives an empty object when nothing parsed', () => {
    expect(parseThreads('')).toEqual({});
    expect(parseThreads('orders:abc bananas')).toEqual({});
  });
});

describe('parseStart', () => {
  const token = '0123456789abcdef0123456789abcdef';

  it('reads the two deep links', () => {
    expect(parseStart(`link_${token}`)).toEqual({ kind: 'link', token });
    expect(parseStart('item_12')).toEqual({ kind: 'item', id: 12 });
  });

  it.each([
    '',
    'link_short',
    `link_${token.toUpperCase()}`,
    `link_${token}0`,
    'item_',
    'item_abc',
    'item_1234567890',
    'promo',
  ])('treats %j as a plain start', (payload) => {
    expect(parseStart(payload)).toEqual({ kind: 'plain' });
  });
});

describe('isFreshConfirm', () => {
  it('holds up to the ttl and not past it', () => {
    expect(isFreshConfirm(1000, 1120, 120)).toBe(true);
    expect(isFreshConfirm(1000, 1121, 120)).toBe(false);
  });
});

describe('supportTarget', () => {
  const user = { id: 42, username: 'test_user' };

  it('reads the id from a support header', () => {
    expect(supportTarget(supportHeader('new', user, 'Привіт'))).toBe('42');
    expect(supportTarget(supportHeader('reply', user, 'Привіт'))).toBe('42');
  });

  it('reads the real id when the name or body carries another tag', () => {
    const named = { id: 42, first_name: '#T123' };
    expect(supportTarget(supportHeader('new', named, 'Привіт'))).toBe('42');
    const forged = "📩 Зворотній зв'язок\n#T123\nВід: хтось\n\nтекст";
    expect(supportTarget(supportHeader('new', user, forged))).toBe('42');
  });

  it('finds nothing in a card, a name or a caption', () => {
    const { text } = orderCardText(
      {
        id: 1,
        status: 'PENDING',
        telegramId: 1n,
        recipientName: '#T123',
        phone: '#T123',
        deliveryMethod: null,
        address: '#T123',
        totalAmount: 1,
        currency: 'UAH',
        warnings: ['#T123'],
        processedByAdmin: null,
        statusBy: null,
        customer: { blockedBot: false },
        items: [],
      },
      1024,
    );
    expect(supportTarget(text)).toBeNull();
    expect(supportTarget('#T123')).toBeNull();
    expect(supportTarget('Дивіться #T123\n')).toBeNull();
    expect(supportTarget('Фото\n#T123\nпідпис')).toBeNull();
    expect(supportTarget('')).toBeNull();
  });
});

describe('parseOwnerIds', () => {
  it('skips invalid chunks', () => {
    expect(parseOwnerIds('1001, 1002,abc,,1003 ,-5')).toEqual([
      1001, 1002, 1003,
    ]);
  });

  it('gives nobody for an empty list', () => {
    expect(parseOwnerIds('')).toEqual([]);
    expect(parseOwnerIds(undefined)).toEqual([]);
  });
});

describe('telegramFailure', () => {
  const tgError = (
    error_code: number,
    description: string,
    parameters: object = {},
  ) =>
    new GrammyError(
      'Call to sendMessage failed!',
      { ok: false, error_code, description, parameters },
      'sendMessage',
      {},
    );

  it('reads a 429 with its wait', () => {
    const err = tgError(429, 'Too Many Requests: retry after 7', {
      retry_after: 7,
    });
    expect(telegramFailure(err)).toEqual({ kind: 'rate', seconds: 7 });
  });

  it('reads a 403 as blocked', () => {
    const err = tgError(403, 'Forbidden: bot was blocked by the user');
    expect(telegramFailure(err)).toEqual({ kind: 'blocked' });
  });

  it('reads a chat migration', () => {
    const err = tgError(400, 'Bad Request: group chat was upgraded', {
      migrate_to_chat_id: -1002,
    });
    expect(telegramFailure(err)).toEqual({ kind: 'migrated', chatId: -1002 });
  });

  it.each([
    ['Bad Request: message thread not found', 'thread'],
    ['Bad Request: TOPIC_CLOSED', 'thread'],
    ['Bad Request: message is not modified: same content', 'unchanged'],
    ['Bad Request: there is no caption in the message to edit', 'wrongEdit'],
    ['Bad Request: there is no text in the message to edit', 'wrongEdit'],
    ['Bad Request: message to edit not found', 'gone'],
    ['Bad Request: chat not found', 'gone'],
    ['Bad Request: reply markup is broken', 'gone'],
    ['Bad Request: PHOTO_INVALID_DIMENSIONS', 'media'],
    ['Bad Request: IMAGE_PROCESS_FAILED', 'media'],
    ['Bad Request: wrong file identifier/HTTP URL specified', 'media'],
  ])('reads a 400 %j', (description, kind) => {
    expect(telegramFailure(tgError(400, description))).toEqual({ kind });
  });

  it('reads a missing file, bare or wrapped by grammY', () => {
    const missing = Object.assign(new Error('no file'), { code: 'ENOENT' });
    expect(telegramFailure(missing)).toEqual({ kind: 'media' });
    expect(telegramFailure(new HttpError('sendPhoto', missing))).toEqual({
      kind: 'media',
    });
  });

  it('calls anything unknown a retry', () => {
    expect(telegramFailure(tgError(502, 'Bad Gateway'))).toEqual({
      kind: 'retry',
    });
    expect(telegramFailure(new Error('socket hang up'))).toEqual({
      kind: 'retry',
    });
    expect(telegramFailure(undefined)).toEqual({ kind: 'retry' });
    expect(telegramFailure('nonsense')).toEqual({ kind: 'retry' });
  });

  it('does not take a 500 with a familiar description for a 400', () => {
    expect(telegramFailure(tgError(500, 'chat not found'))).toEqual({
      kind: 'retry',
    });
  });
});

describe('isAvailable', () => {
  it('sells unlimited and positive stock', () => {
    expect(isAvailable({ stock: null })).toBe(true);
    expect(isAvailable({ stock: 1 })).toBe(true);
    expect(isAvailable({ stock: 0 })).toBe(false);
  });
});

describe('id pipes', () => {
  it('passes a sane id on as a number', () => {
    expect(new MerchIdPipe().transform('12')).toBe(12);
    expect(new MerchIdPipe().transform('999999999')).toBe(999999999);
  });

  it.each(['', '0', '-1', '007', '1.5', '1e3', 'abc', '2147483648'])(
    'answers 404 to id %j, so it never reaches Postgres',
    (value) => {
      expect(() => new MerchIdPipe().transform(value)).toThrow(
        NotFoundException,
      );
    },
  );

  it('knows the two label kinds only', () => {
    expect(new MerchKindPipe().transform('category')).toBe('category');
    expect(new MerchKindPipe().transform('tag')).toBe('tag');
    expect(() => new MerchKindPipe().transform('group')).toThrow(
      NotFoundException,
    );
  });
});

describe('DTOs, with the options of the global pipe', () => {
  const UUID = '123e4567-e89b-42d3-a456-426614174000';
  const OWN_JPG = `/uploads/${UUID}.jpg`;

  const messages = (errors: ValidationError[]): string[] =>
    errors.flatMap((e) => [
      ...Object.values(e.constraints ?? {}),
      ...messages(e.children ?? []),
    ]);
  const refusals = (dto: new () => object, body: object) =>
    messages(
      validateSync(plainToInstance(dto, body), {
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

  // Every field of CreateOrderBody and ProductBody in client/web/lib/merch-types.ts.
  const ORDER = {
    clientKey: UUID,
    lines: [{ variantId: 1, quantity: 2, label: 'Футболка M' }],
    expectedTotal: '1000.00',
    delivery: 'NOVA_POSHTA',
    address: 'Київ, відділення 5',
    recipientId: 3,
    recipientName: 'Тарас Вигаданий',
    recipientPhone: '+380501112233',
    saveRecipient: true,
    receiptUrl: OWN_JPG,
  };
  const PRODUCT = {
    saveKey: UUID,
    seenKey: null,
    title: 'Футболка',
    description: 'Бавовна',
    categoryId: null,
    tagIds: [1],
    groupIds: [],
    variants: [
      {
        size: 'M',
        color: '',
        price: '500.00',
        order: 0,
        stock: null,
        stockSeen: null,
      },
    ],
    photos: [{ color: '', url: OWN_JPG, thumbUrl: OWN_JPG }],
  };

  it('accepts everything the client sends', () => {
    expect(refusals(CreateOrderDto, ORDER)).toEqual([]);
    expect(refusals(ProductDto, PRODUCT)).toEqual([]);
    expect(
      refusals(PickupDto, { pickupSlotId: null, needsIndividualPickup: true }),
    ).toEqual([]);
    expect(
      refusals(TemplateDto, {
        name: 'Базова футболка',
        description: '',
        categoryId: null,
        tagIds: [],
        groupIds: [],
        sizes: ['M'],
        colors: [],
        prices: [{ size: 'M', color: '', price: '500' }],
      }),
    ).toEqual([]);
  });

  it('refuses a field nobody declared', () => {
    expect(refusals(CreateOrderDto, { ...ORDER, price: '1.00' })).toEqual([
      'property price should not exist',
    ]);
  });

  it.each<[string, object, string]>([
    ['an empty cart', { lines: [] }, 'Кошик порожній.'],
    ['legacy delivery', { delivery: 'CAMPUS' }, 'Оберіть спосіб доставки.'],
    [
      'a foreign receipt',
      { receiptUrl: 'https://example.test/a.jpg' },
      'Завантажте скріншот квитанції.',
    ],
  ])('words %s for the customer', (_name, change, message) => {
    expect(refusals(CreateOrderDto, { ...ORDER, ...change })).toEqual([
      message,
    ]);
  });

  it.each<[string, object]>([
    ['a key that is no UUID', { clientKey: 'abc' }],
    ['three decimals', { expectedTotal: '1.234' }],
    [
      'a quantity above the cap',
      { lines: [{ variantId: 1, quantity: 100, label: 'a' }] },
    ],
    ['a line without a label', { lines: [{ variantId: 1, quantity: 1 }] }],
  ])('refuses %s', (_name, change) => {
    expect(refusals(CreateOrderDto, { ...ORDER, ...change })).not.toEqual([]);
  });

  it('checks the variants and photos inside a product', () => {
    const [variant] = PRODUCT.variants;
    const product = (change: object) => ({ ...PRODUCT, ...change });
    expect(
      refusals(ProductDto, product({ variants: [{ ...variant, stock: -1 }] })),
    ).toHaveLength(1);
    expect(
      refusals(
        ProductDto,
        product({
          photos: [{ color: '', url: '/uploads/a.jpg', thumbUrl: OWN_JPG }],
        }),
      ),
    ).toHaveLength(1);
    expect(
      refusals(ProductDto, product({ variants: Array(301).fill(variant) })),
    ).toHaveLength(1);
    expect(refusals(ProductDto, product({ variants: [] }))).toEqual([
      'Додайте хоча б один варіант',
    ]);
  });
});
