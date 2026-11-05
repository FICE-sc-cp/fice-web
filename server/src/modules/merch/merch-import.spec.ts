import {
  cleanUsername,
  DEFAULT_NO_SIZE,
  isImageBytes,
  mapDelivery,
  mapOrder,
  mapSlot,
  mapStatus,
  mergeMembers,
  mergeRecipients,
  missingTables,
  normalizeOldVariants,
  OLD_COLUMNS,
  OldData,
  OldItem,
  OldMember,
  OldOrder,
  OldProduct,
  OldRecipient,
  OldVariant,
  parseOldTime,
  photoRow,
  photoTargets,
  pickBinding,
  planImport,
  selectExpr,
  sequenceTarget,
  stockTakenFor,
  variantKey,
} from './merch-import';
import { NO_SIZE } from './merch-rules';

const variant = (
  id: number,
  size: string,
  color: string | null,
  stock_quantity: number | null = 5,
  price = '100.00',
): OldVariant => ({ id, product_id: 1, size, color, price, stock_quantity });

const product = (over: Partial<OldProduct> = {}): OldProduct => ({
  id: 1,
  title: 'Футболка',
  description: 'Бавовна',
  photo_file_id: null,
  photo_black_file_id: null,
  is_active: true,
  requires_color: false,
  created_at: '2026-01-02 03:04:05',
  updated_at: '2026-01-02 03:04:05',
  ...over,
});

const order = (over: Partial<OldOrder> = {}): OldOrder => ({
  id: 1,
  telegram_id: '1001',
  status: 'pending',
  delivery_method: 'later_campus',
  address: 'Корпус 18',
  phone: '+380500000001',
  recipient_name: 'Тарас Вигаданий',
  total_amount: '100.00',
  currency: 'UAH',
  receipt_photo_id: 'receipt-1',
  admin_message_id: 7,
  processed_by_admin: null,
  pickup_slot_id: null,
  needs_individual_pickup: null,
  created_at: '2026-03-01 10:00:00',
  updated_at: '2026-03-01 10:00:00',
  ...over,
});

const item = (over: Partial<OldItem> = {}): OldItem => ({
  id: 1,
  order_id: 1,
  product_id: 1,
  title: 'Футболка',
  size: 'M',
  color: null,
  unit_price: '100.00',
  quantity: 2,
  ...over,
});

const recipient = (over: Partial<OldRecipient>): OldRecipient => ({
  id: 1,
  telegram_id: '1001',
  full_name: 'Тарас Вигаданий',
  phone: '+380500000001',
  is_default: false,
  created_at: '2026-03-01 10:00:00',
  ...over,
});

const member = (over: Partial<OldMember>): OldMember => ({
  id: 1,
  group_id: 1,
  telegram_id: null,
  username: null,
  created_at: null,
  ...over,
});

const emptyOld = (): OldData => ({
  products: [],
  product_variants: [],
  orders: [],
  order_items: [],
  user_profiles: [],
  recipients: [],
  admin_chat_bindings: [],
  shop_configs: [],
  user_groups: [],
  user_group_members: [],
  product_visibility: [],
  pickup_slots: [],
});

describe('photoRow', () => {
  it('keeps the target, whatever the reused row held', () => {
    const lastRun = {
      id: 9,
      productId: 3,
      color: 'Чорний',
      sourceFileId: 'f-hoodie',
      url: '/uploads/a.jpg',
      thumbUrl: '/uploads/b.jpg',
    };
    expect(
      photoRow({ productId: 2, color: 'Білий', fileId: 'f-hoodie' }, lastRun),
    ).toStrictEqual({
      productId: 2,
      color: 'Білий',
      sourceFileId: 'f-hoodie',
      url: '/uploads/a.jpg',
      thumbUrl: '/uploads/b.jpg',
    });
  });
});

describe('selectExpr', () => {
  it('turns a missing column into a NULL of the same name', () => {
    expect(selectExpr('recipient_name')).toBe('NULL AS "recipient_name"');
  });

  it('reads an enum as text', () => {
    expect(selectExpr('status', 'USER-DEFINED')).toBe(
      '"status"::text AS "status"',
    );
  });

  it.each(['timestamp without time zone', 'timestamp with time zone', 'date'])(
    'reads %s through one timestamp expression',
    (type) => {
      expect(selectExpr('created_at', type)).toBe(
        '("created_at"::timestamp)::text AS "created_at"',
      );
    },
  );

  it('leaves everything else alone', () => {
    expect(selectExpr('price', 'numeric')).toBe('"price"');
  });
});

describe('parseOldTime', () => {
  it('reads the text as a UTC wall clock', () => {
    expect(parseOldTime('2026-04-03 12:34:56')?.toISOString()).toBe(
      '2026-04-03T12:34:56.000Z',
    );
  });

  it('accepts the six fractional digits Postgres prints', () => {
    expect(parseOldTime('2026-04-03 12:34:56.123456')?.toISOString()).toBe(
      '2026-04-03T12:34:56.123Z',
    );
  });

  it('keeps null', () => {
    expect(parseOldTime(null)).toBeNull();
  });
});

describe('mapStatus and mapDelivery', () => {
  it.each([
    ['pending', 'PENDING'],
    ['in_process', 'IN_PROCESS'],
    ['ready_for_pickup', 'READY_FOR_PICKUP'],
    ['completed', 'COMPLETED'],
    ['cancelled', 'CANCELLED'],
  ])('maps status %s', (text, status) => {
    expect(mapStatus(text)).toBe(status);
  });

  it.each([
    ['nova_poshta', 'NOVA_POSHTA'],
    ['campus', 'CAMPUS'],
    ['dayf', 'DAYF'],
    ['later_campus', 'LATER_CAMPUS'],
    [null, null],
  ])('maps delivery %s', (text, delivery) => {
    expect(mapDelivery(text)).toBe(delivery);
  });

  it('stops on an unknown value and prints it', () => {
    expect(() => mapStatus('lost_in_mail')).toThrow('lost_in_mail');
    expect(() => mapDelivery('teleport')).toThrow('teleport');
  });
});

describe('normalizeOldVariants', () => {
  it('keeps the lowest id of NULL colour duplicates', () => {
    const n = normalizeOldVariants(
      [variant(9, 'M', null, 1), variant(4, 'M', null, 2)],
      false,
      DEFAULT_NO_SIZE,
    );
    expect(n.rows).toEqual([
      { size: 'M', color: '', price: '100.00', stock: 2, order: 0 },
    ]);
    expect(n.dropped.map((r) => r.id)).toEqual([9]);
  });

  it('counts a stray colour on a product without colours as the same variant', () => {
    const n = normalizeOldVariants(
      [variant(1, 'M', 'Білий'), variant(2, 'M', null)],
      false,
      DEFAULT_NO_SIZE,
    );
    expect(n.rows).toHaveLength(1);
    expect(n.rows[0].color).toBe('');
    expect(n.dropped).toHaveLength(1);
  });

  it('clamps negative stock and reports the row', () => {
    const n = normalizeOldVariants(
      [variant(1, 'M', null, -3), variant(2, 'L', null, 0)],
      false,
      DEFAULT_NO_SIZE,
    );
    expect(n.rows.map((r) => r.stock)).toEqual([0, 0]);
    expect(n.clamped.map((r) => r.id)).toEqual([1]);
  });

  it('leaves unlimited stock unlimited', () => {
    const n = normalizeOldVariants(
      [variant(1, 'M', null, null)],
      false,
      DEFAULT_NO_SIZE,
    );
    expect(n.rows[0].stock).toBeNull();
    expect(n.clamped).toEqual([]);
  });

  it.each(['ONE', 'one size', ' Універсальний ', '-'])(
    'turns the alias %s into NO_SIZE',
    (size) => {
      const n = normalizeOldVariants(
        [variant(1, size, null)],
        false,
        DEFAULT_NO_SIZE,
      );
      expect(n.rows[0].size).toBe(NO_SIZE);
      expect(n.sizeMap.get(size)).toBe(NO_SIZE);
    },
  );

  it('keeps colours of an alias size and drops the size', () => {
    const n = normalizeOldVariants(
      [variant(1, 'ONE', 'Білий'), variant(2, 'ONE', 'Чорний')],
      true,
      DEFAULT_NO_SIZE,
    );
    expect(n.rows.map((r) => [r.size, r.color, r.order])).toEqual([
      [NO_SIZE, 'Білий', 0],
      [NO_SIZE, 'Чорний', 1],
    ]);
  });

  it('never rewrites a real size, even a single one', () => {
    const n = normalizeOldVariants(
      [variant(1, 'M', null)],
      false,
      DEFAULT_NO_SIZE,
    );
    expect(n.rows[0].size).toBe('M');
    expect(n.sizeMap.get('M')).toBe('M');
  });

  it('keeps an alias that sits next to a real size', () => {
    const n = normalizeOldVariants(
      [variant(1, 'ONE', null), variant(2, 'XL', null)],
      false,
      DEFAULT_NO_SIZE,
    );
    expect(n.rows.map((r) => r.size)).toEqual(['ONE', 'XL']);
  });

  it('a --no-size list replaces the default', () => {
    const rows = [variant(1, 'ONE', null)];
    expect(normalizeOldVariants(rows, false, ['ШТ']).rows[0].size).toBe('ONE');
    expect(
      normalizeOldVariants([variant(1, 'шт', null)], false, ['ШТ']).rows[0]
        .size,
    ).toBe(NO_SIZE);
  });

  it('stores both matrix axes in first-seen order', () => {
    const n = normalizeOldVariants(
      [
        variant(1, 'S', 'Білий'),
        variant(2, 'S', 'Чорний'),
        variant(3, 'M', 'Чорний'),
      ],
      true,
      DEFAULT_NO_SIZE,
    );
    expect(n.rows.map((r) => r.order)).toEqual([0, 1, 101]);
  });

  it('stops on a negative price', () => {
    expect(() =>
      normalizeOldVariants(
        [variant(3, 'M', null, 1, '-1.00')],
        false,
        DEFAULT_NO_SIZE,
      ),
    ).toThrow('product_variants row 3');
  });

  it('does not stop on a negative price of a dropped duplicate', () => {
    const n = normalizeOldVariants(
      [variant(1, 'M', null), variant(2, 'M', null, 1, '-1.00')],
      false,
      DEFAULT_NO_SIZE,
    );
    expect(n.dropped).toHaveLength(1);
  });
});

describe('stockTakenFor', () => {
  it.each(['PENDING', 'IN_PROCESS', 'READY_FOR_PICKUP'] as const)(
    '%s took stock',
    (status) => {
      expect(stockTakenFor(status, 3, 5)).toBe(3);
      expect(stockTakenFor(status, 3, 0)).toBe(3);
    },
  );

  it.each(['COMPLETED', 'CANCELLED'] as const)(
    '%s has nothing to give back',
    (status) => {
      expect(stockTakenFor(status, 3, 5)).toBe(0);
    },
  );

  it('unlimited and unmatched variants took nothing', () => {
    expect(stockTakenFor('PENDING', 3, null)).toBe(0);
    expect(stockTakenFor('PENDING', 3, undefined)).toBe(0);
  });
});

describe('photoTargets', () => {
  const main = 'main-file';
  const black = 'black-file';
  const colored = (
    photo_file_id: string | null,
    photo_black_file_id: string | null,
  ) => ({
    requires_color: true,
    photo_file_id,
    photo_black_file_id,
  });

  it('no colours: the main photo has colour empty', () => {
    expect(
      photoTargets(
        {
          requires_color: false,
          photo_file_id: main,
          photo_black_file_id: null,
        },
        [''],
      ),
    ).toEqual([{ fileId: main, color: '' }]);
  });

  it('no colours: a black photo is ignored', () => {
    expect(
      photoTargets(
        {
          requires_color: false,
          photo_file_id: main,
          photo_black_file_id: black,
        },
        [''],
      ),
    ).toEqual([{ fileId: main, color: '' }]);
    expect(
      photoTargets(
        {
          requires_color: null,
          photo_file_id: null,
          photo_black_file_id: black,
        },
        [''],
      ),
    ).toEqual([]);
  });

  it('colours: main goes to Білий, black to Чорний', () => {
    expect(
      photoTargets(colored(main, black), ['Чорний', 'Синій', 'Білий']),
    ).toEqual([
      { fileId: main, color: 'Білий' },
      { fileId: black, color: 'Чорний' },
    ]);
  });

  it('colours: without Білий main takes the first colour that is not Чорний', () => {
    expect(
      photoTargets(colored(main, black), ['Чорний', 'Синій', 'Зелений']),
    ).toEqual([
      { fileId: main, color: 'Синій' },
      { fileId: black, color: 'Чорний' },
    ]);
  });

  it('a black-only product keeps its only photo', () => {
    expect(photoTargets(colored(main, null), ['Чорний'])).toEqual([
      { fileId: main, color: 'Чорний' },
    ]);
  });

  it('a black-only product with both photos keeps the black one', () => {
    expect(photoTargets(colored(main, black), ['Чорний'])).toEqual([
      { fileId: black, color: 'Чорний' },
    ]);
  });

  it('a black photo without a Чорний variant is skipped', () => {
    expect(photoTargets(colored(null, black), ['Синій'])).toEqual([]);
    expect(photoTargets(colored(main, black), ['Синій'])).toEqual([
      { fileId: main, color: 'Синій' },
    ]);
  });

  it('a colour product with no variants has nowhere to put a photo', () => {
    expect(photoTargets(colored(main, null), [])).toEqual([]);
  });

  it('a colour product with NULL colours still keeps its photo', () => {
    expect(photoTargets(colored(main, null), [''])).toEqual([
      { fileId: main, color: '' },
    ]);
  });
});

describe('order mapping', () => {
  const slots = new Set([3]);

  it.each(['pending', 'in_process', 'ready_for_pickup', 'completed'])(
    '%s fills statusBy from the taker',
    (status) => {
      const o = mapOrder(order({ status, processed_by_admin: 'Оля' }), slots);
      expect(o.processedByAdmin).toBe('Оля');
      expect(o.statusBy).toBe('Оля');
    },
  );

  it('cancelled leaves statusBy empty and keeps the taker', () => {
    const o = mapOrder(
      order({ status: 'cancelled', processed_by_admin: 'Оля' }),
      slots,
    );
    expect(o.processedByAdmin).toBe('Оля');
    expect(o.statusBy).toBeNull();
  });

  it('keeps a known slot and drops a dangling one', () => {
    expect(mapOrder(order({ pickup_slot_id: 3 }), slots).pickupSlotId).toBe(3);
    expect(mapOrder(order({ pickup_slot_id: 99 }), slots).pickupSlotId).toBe(
      null,
    );
  });

  it('turns a nullable pickup flag into false and moves the receipt', () => {
    const o = mapOrder(order(), slots);
    expect(o.needsIndividualPickup).toBe(false);
    expect(o.receiptFileId).toBe('receipt-1');
    expect(o.telegramId).toBe(1001n);
    expect(o).not.toHaveProperty('receiptUrl');
    expect(o).not.toHaveProperty('clientKey');
    expect(o).not.toHaveProperty('cardDirty');
  });

  it('stops on an unknown delivery', () => {
    expect(() =>
      mapOrder(order({ delivery_method: 'teleport' }), slots),
    ).toThrow('teleport');
  });
});

describe('mapSlot', () => {
  it('takes the day out of a timestamp', () => {
    const slot = mapSlot({
      id: 1,
      date: '2026-11-12 00:00:00',
      start_time: '12:00',
      end_time: '14:00',
      is_active: true,
    });
    expect(slot.date.toISOString()).toBe('2026-11-12T00:00:00.000Z');
    expect(slot).toMatchObject({
      startTime: '12:00',
      endTime: '14:00',
      isActive: true,
    });
  });

  it('a time that is no time becomes 00:00 and the slot goes inactive', () => {
    expect(
      mapSlot({
        id: 1,
        date: '2026-11-12 00:00:00',
        start_time: 'banana',
        end_time: '14:00',
        is_active: true,
      }),
    ).toMatchObject({ startTime: '00:00', endTime: '14:00', isActive: false });
  });

  it('an inactive slot stays inactive', () => {
    expect(
      mapSlot({
        id: 1,
        date: '2026-11-12 00:00:00',
        start_time: '12:00',
        end_time: '14:00',
        is_active: false,
      }).isActive,
    ).toBe(false);
  });
});

describe('mergeRecipients', () => {
  it('merges phone spellings into the first row', () => {
    const { rows, merged } = mergeRecipients([
      recipient({ id: 4, phone: '050 000-00-01' }),
      recipient({ id: 5, phone: '+380500000001' }),
      recipient({ id: 6, full_name: 'Інша Людина' }),
    ]);
    expect(rows.map((r) => [r.id, r.phone])).toEqual([
      [4, '+380500000001'],
      [6, '+380500000001'],
    ]);
    expect(merged).toBe(1);
  });

  it('keeps a phone it cannot normalize', () => {
    expect(
      mergeRecipients([recipient({ phone: 'не памятаю' })]).rows[0].phone,
    ).toBe('не памятаю');
  });

  it('a merged row keeps the default of any of its copies', () => {
    const { rows } = mergeRecipients([
      recipient({ id: 1 }),
      recipient({ id: 2, is_default: true }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].isDefault).toBe(true);
  });

  it('keeps at most one default per customer, the newest', () => {
    const { rows } = mergeRecipients([
      recipient({ id: 1, full_name: 'Перша', is_default: true }),
      recipient({ id: 2, full_name: 'Друга', is_default: true }),
      recipient({
        id: 3,
        telegram_id: '1002',
        full_name: 'Третя',
        is_default: true,
      }),
    ]);
    expect(rows.map((r) => r.isDefault)).toEqual([false, true, true]);
  });
});

describe('mergeMembers', () => {
  it('lowercases usernames, strips @ and merges duplicates', () => {
    const { rows, merged, skipped } = mergeMembers([
      member({ id: 1, username: '@Good_User' }),
      member({ id: 2, username: 'good_user' }),
      member({ id: 3, group_id: 2, username: 'good_user' }),
    ]);
    expect(rows.map((r) => [r.groupId, r.username])).toEqual([
      [1, 'good_user'],
      [2, 'good_user'],
    ]);
    expect([merged, skipped]).toEqual([1, 0]);
  });

  it('merges ids too', () => {
    const { rows, merged } = mergeMembers([
      member({ telegram_id: '1001' }),
      member({ telegram_id: '1001' }),
    ]);
    expect(rows).toHaveLength(1);
    expect(merged).toBe(1);
  });

  it('both set: the telegram id stays, so the CHECK holds', () => {
    const { rows } = mergeMembers([
      member({ telegram_id: '1001', username: '@Good_User' }),
    ]);
    expect(rows[0]).toMatchObject({ telegramId: 1001n, username: null });
  });

  it('neither set, or nothing left of the name: skipped', () => {
    const { rows, merged, skipped } = mergeMembers([
      member({}),
      member({ username: '@' }),
    ]);
    expect(rows).toEqual([]);
    expect([merged, skipped]).toEqual([0, 2]);
  });
});

describe('cleanUsername', () => {
  it('matches the old normalization', () => {
    expect(cleanUsername(' @Some_Name ')).toBe('some_name');
    expect(cleanUsername(null)).toBeNull();
    expect(cleanUsername('')).toBeNull();
  });
});

describe('missingTables', () => {
  it('names what the known stale shape lacks', () => {
    const stale = new Set(['products', 'orders']);
    expect(missingTables(stale)).toEqual([
      'product_variants',
      'order_items',
      'user_profiles',
      'recipients',
      'admin_chat_bindings',
      'shop_configs',
      'user_groups',
      'user_group_members',
      'product_visibility',
      'pickup_slots',
    ]);
  });

  it('accepts the full set, extra tables included', () => {
    const full = new Set([
      ...Object.keys(OLD_COLUMNS),
      'cart_items',
      'product_sizes',
    ]);
    expect(missingTables(full)).toEqual([]);
  });
});

describe('pickBinding', () => {
  const binding = (id: number, is_active: boolean) => ({
    id,
    chat_id: `-100${id}`,
    title: `Чат ${id}`,
    is_active,
    orders_thread_id: 0,
    support_thread_id: id,
  });

  it('none active: no chat', () => {
    expect(pickBinding([binding(1, false)])).toEqual({
      active: 0,
      chat: undefined,
    });
  });

  it('two active: the newest id, and thread 0 is null', () => {
    const { active, chat } = pickBinding([
      binding(1, true),
      binding(3, true),
      binding(2, false),
    ]);
    expect(active).toBe(2);
    expect(chat).toEqual({
      adminChatId: -1003n,
      adminChatTitle: 'Чат 3',
      ordersThreadId: null,
      supportThreadId: 3,
    });
  });
});

describe('sequenceTarget', () => {
  it('keeps a /clear_orders gap', () => {
    expect(sequenceTarget({ last_value: '1000', is_called: true }, 21)).toEqual(
      { value: 1000, called: true },
    );
  });

  it('moves past rows above the sequence', () => {
    expect(sequenceTarget({ last_value: '5', is_called: true }, 21)).toEqual({
      value: 21,
      called: true,
    });
  });

  it('a sequence never called hands out its value next', () => {
    expect(sequenceTarget({ last_value: '1', is_called: false }, 0)).toEqual({
      value: 1,
      called: false,
    });
  });

  it('a row sitting on an uncalled value is not handed out again', () => {
    expect(sequenceTarget({ last_value: '1', is_called: false }, 1)).toEqual({
      value: 1,
      called: true,
    });
  });

  it('a table without a sequence starts after its rows', () => {
    expect(sequenceTarget(null, 21)).toEqual({ value: 21, called: true });
    expect(sequenceTarget(null, 0)).toEqual({ value: 1, called: false });
  });
});

describe('isImageBytes', () => {
  it.each([
    ['JPEG', [0xff, 0xd8, 0xff, 0xe0]],
    ['PNG', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    ['WebP', [...Buffer.from('RIFF0000WEBP')]],
  ])('accepts %s', (_name, bytes) => {
    expect(isImageBytes(Buffer.from(bytes))).toBe(true);
  });

  it('refuses anything else', () => {
    expect(isImageBytes(Buffer.from('<html>'))).toBe(false);
    expect(isImageBytes(Buffer.alloc(0))).toBe(false);
  });
});

describe('planImport', () => {
  const shop = (over: Partial<OldData>): OldData => ({
    ...emptyOld(),
    ...over,
  });

  it('seeds the catalog order from the id, newest first', () => {
    const plan = planImport(
      shop({ products: [product({ id: 3 }), product({ id: 8 })] }),
      DEFAULT_NO_SIZE,
    );
    expect(plan.products.map((p) => p.order)).toEqual([-3, -8]);
    expect(plan.products[0]).toMatchObject({
      categoryId: null,
      createdAt: new Date('2026-01-02T03:04:05.000Z'),
    });
  });

  it('links variants to products and tags unlimited ones', () => {
    const plan = planImport(
      shop({
        products: [product({ id: 1 }), product({ id: 2 })],
        product_variants: [
          { ...variant(1, 'M', null, null), product_id: 1 },
          { ...variant(2, 'M', null, 3), product_id: 2 },
        ],
      }),
      DEFAULT_NO_SIZE,
    );
    expect(plan.variants.map((v) => v.productId)).toEqual([1, 2]);
    expect(plan.preorderProductIds).toEqual([1]);
  });

  it('a dropped unlimited duplicate does not tag the product', () => {
    const plan = planImport(
      shop({
        products: [product()],
        product_variants: [
          variant(1, 'M', null, 3),
          variant(2, 'M', null, null),
        ],
      }),
      DEFAULT_NO_SIZE,
    );
    expect(plan.preorderProductIds).toEqual([]);
    expect(plan.notes.droppedVariants).toHaveLength(1);
  });

  it('makes a stub for an order or a recipient without a profile', () => {
    const plan = planImport(
      shop({
        user_profiles: [
          {
            telegram_id: '1001',
            username: '@Some_Name',
            first_name: 'Ім’я',
            last_name: null,
            created_at: '2026-01-01 00:00:00',
          },
        ],
        orders: [order({ telegram_id: '1002' }), order({ id: 2 })],
        recipients: [recipient({ telegram_id: '1003' })],
      }),
      DEFAULT_NO_SIZE,
    );
    expect(plan.customers.map((c) => c.telegramId)).toEqual([
      1001n,
      1002n,
      1003n,
    ]);
    expect(plan.customers[0]).toMatchObject({ username: 'some_name' });
    expect(plan.notes.customerStubs).toBe(2);
  });

  it('counts dangling slot references and bad slots', () => {
    const plan = planImport(
      shop({
        pickup_slots: [
          {
            id: 5,
            date: '2026-11-12 00:00:00',
            start_time: 'banana',
            end_time: '14:00',
            is_active: true,
          },
        ],
        orders: [order({ pickup_slot_id: 5 }), order({ pickup_slot_id: 777 })],
      }),
      DEFAULT_NO_SIZE,
    );
    expect(plan.orders.map((o) => o.pickupSlotId)).toEqual([5, null]);
    expect(plan.notes.danglingSlotRefs).toBe(1);
    expect(plan.notes.badSlots).toEqual([5]);
  });

  it('counts orders in flight, per status', () => {
    const plan = planImport(
      shop({
        orders: [
          order({ id: 1 }),
          order({ id: 2 }),
          order({ id: 3, status: 'ready_for_pickup' }),
          order({ id: 4, status: 'completed' }),
        ],
      }),
      DEFAULT_NO_SIZE,
    );
    expect(plan.notes.inFlightOrders).toEqual({
      PENDING: 2,
      READY_FOR_PICKUP: 1,
    });
  });

  describe('order items', () => {
    const sticker = shop({
      products: [product()],
      product_variants: [variant(1, 'ONE', null, 4)],
      orders: [order()],
    });

    it('share the size mapping and find the variant', () => {
      const plan = planImport(
        { ...sticker, order_items: [item({ size: 'ONE' })] },
        DEFAULT_NO_SIZE,
      );
      expect(plan.items[0]).toMatchObject({
        size: NO_SIZE,
        color: '',
        productId: 1,
        stockTaken: 2,
        variantKey: variantKey(1, NO_SIZE, ''),
      });
    });

    it('a variant that went away takes nothing and keeps the snapshot', () => {
      const plan = planImport(
        { ...sticker, order_items: [item({ size: 'XXL' })] },
        DEFAULT_NO_SIZE,
      );
      expect(plan.items[0]).toMatchObject({ size: 'XXL', stockTaken: 0 });
    });

    it('an unlimited variant takes nothing', () => {
      const plan = planImport(
        {
          ...sticker,
          product_variants: [variant(1, 'M', null, null)],
          order_items: [item()],
        },
        DEFAULT_NO_SIZE,
      );
      expect(plan.items[0].stockTaken).toBe(0);
    });

    it('an unknown product is null, the snapshot stays', () => {
      const plan = planImport(
        {
          ...sticker,
          order_items: [
            item({ id: 1, product_id: null, size: 'ONE' }),
            item({ id: 2, product_id: 404, size: 'ONE' }),
          ],
        },
        DEFAULT_NO_SIZE,
      );
      expect(
        plan.items.map((i) => [i.productId, i.size, i.variantKey]),
      ).toEqual([
        [null, 'ONE', null],
        [null, 'ONE', null],
      ]);
      expect(plan.items.map((i) => i.stockTaken)).toEqual([0, 0]);
    });

    it('a colour line on a product that dropped colours finds its variant', () => {
      const plan = planImport(
        {
          ...sticker,
          product_variants: [variant(1, 'M', null, 4)],
          order_items: [item({ color: 'Білий' })],
        },
        DEFAULT_NO_SIZE,
      );
      expect(plan.items[0]).toMatchObject({
        color: 'Білий',
        stockTaken: 2,
        variantKey: variantKey(1, 'M', ''),
      });
    });

    it('stops on a quantity below 1 and names the row', () => {
      expect(() =>
        planImport(
          { ...sticker, order_items: [item({ id: 42, quantity: 0 })] },
          DEFAULT_NO_SIZE,
        ),
      ).toThrow('order_items row 42');
    });
  });

  it('reads config 1 only and leaves defaults without it', () => {
    const config = {
      id: 1,
      welcome_text: 'Привіт',
      currency: 'UAH',
      mono_jar_url: 'https://send.monobank.ua/jar/test',
      card_number: null,
      is_dayf_delivery_enabled: null,
    };
    expect(planImport(shop({ shop_configs: [config] }), []).config).toEqual({
      welcomeText: 'Привіт',
      currency: 'UAH',
      monoJarUrl: 'https://send.monobank.ua/jar/test',
      cardNumber: null,
      dayfEnabled: false,
    });
    expect(
      planImport(shop({ shop_configs: [{ ...config, id: 2 }] }), []).config,
    ).toBeUndefined();
  });

  it('reports visibility it cannot keep, by id', () => {
    const plan = planImport(
      shop({
        products: [product()],
        user_groups: [{ id: 1, name: 'Куратори', created_at: null }],
        product_visibility: [
          { id: 1, product_id: 1, group_id: 1 },
          { id: 2, product_id: 1, group_id: 1 },
          { id: 3, product_id: 1, group_id: 404 },
        ],
      }),
      DEFAULT_NO_SIZE,
    );
    expect(plan.productGroups).toEqual([{ productId: 1, groupId: 1 }]);
    expect(plan.notes.skippedVisibility).toEqual([
      { productId: 1, groupId: 1 },
      { productId: 1, groupId: 404 },
    ]);
  });

  it('builds photo targets from colours in use and reports what is left over', () => {
    const plan = planImport(
      shop({
        products: [
          product({
            requires_color: true,
            photo_file_id: 'main-file',
            photo_black_file_id: 'black-file',
          }),
        ],
        product_variants: [variant(1, 'M', 'Синій')],
      }),
      DEFAULT_NO_SIZE,
    );
    expect(plan.photoTargets).toEqual([
      { productId: 1, fileId: 'main-file', color: 'Синій' },
    ]);
    expect(plan.notes.ignoredPhotos).toEqual([1]);
  });

  it('prints the sizes of single-size products in a histogram', () => {
    const plan = planImport(
      shop({
        products: [product({ id: 1 }), product({ id: 2 }), product({ id: 3 })],
        product_variants: [
          { ...variant(1, 'ONE', null), product_id: 1 },
          { ...variant(2, 'ONE', null), product_id: 2 },
          { ...variant(3, 'S', null), product_id: 3 },
          { ...variant(4, 'M', null), product_id: 3 },
        ],
      }),
      DEFAULT_NO_SIZE,
    );
    expect(plan.notes.sizeHistogram).toEqual({ ONE: 2 });
  });

  it('lists active products without variants, not archived ones', () => {
    const plan = planImport(
      shop({
        products: [product({ id: 1 }), product({ id: 2, is_active: false })],
      }),
      DEFAULT_NO_SIZE,
    );
    expect(plan.notes.activeWithoutVariants).toEqual([1]);
  });

  it('puts no telegram file id and no personal data into the notes', () => {
    const plan = planImport(
      shop({
        products: [product({ photo_file_id: 'SECRET-FILE' })],
        product_variants: [variant(1, 'M', null, -1)],
        recipients: [recipient({ full_name: 'SECRET-NAME' })],
        orders: [order({ phone: 'SECRET-PHONE' })],
      }),
      DEFAULT_NO_SIZE,
    );
    expect(JSON.stringify(plan.notes)).not.toContain('SECRET');
  });
});
