import type { MerchOrderStatus } from '@prisma/client';
import {
  CAPTION_LIMIT,
  NO_SIZE,
  parseStatusCallback,
  TEXT_LIMIT,
  TRANSITIONS,
} from './merch-rules';
import {
  adminKeyboard,
  CardOrder,
  DELIVERY_LABEL,
  orderCardText,
  ordersTable,
  pickupNotices,
  receivedNotice,
  SheetOrder,
  STATUS_LABEL,
  statusKeyboard,
  statusNotice,
  supportHeader,
  TEXT,
  threadsDone,
} from './merch-texts';

const order = (over: Partial<CardOrder> = {}): CardOrder => ({
  id: 17,
  status: 'PENDING',
  telegramId: 1001n,
  recipientName: 'Тарас Вигаданий',
  phone: '+380501112233',
  deliveryMethod: 'NOVA_POSHTA',
  address: 'Київ, відділення 5',
  totalAmount: 1500,
  currency: 'UAH',
  warnings: [],
  processedByAdmin: null,
  statusBy: null,
  customer: { blockedBot: false },
  items: [
    {
      title: 'Футболка',
      size: 'M',
      color: 'Білий',
      quantity: 2,
      unitPrice: 500,
    },
    { title: 'Наліпка', size: NO_SIZE, color: '', quantity: 1, unitPrice: 500 },
  ],
  ...over,
});

describe('orderCardText', () => {
  it('prints the old card', () => {
    expect(orderCardText(order(), CAPTION_LIMIT)).toEqual({
      text: [
        '🔔 Замовлення #17 [🕐 Очікує]',
        '👤 Клієнт: tg://user?id=1001 (1001)',
        '📋 Отримувач: Тарас Вигаданий',
        '📞 Телефон: +380501112233',
        '🚚 Спосіб: Нова Пошта | Адреса: Київ, відділення 5',
        '💰 Сума: 1500.00 UAH',
        '',
        '📦 Позиції:',
        '▫️ Футболка | M | Білий | 2 шт x 500.00 грн',
        '▫️ Наліпка | 1 шт x 500.00 грн',
      ].join('\n'),
      overflow: null,
    });
  });

  it.each<
    [MerchOrderStatus, string, string | null, string | null, string | null]
  >([
    ['PENDING', '🕐 Очікує', 'Олена', 'Марко', null],
    ['IN_PROCESS', '🔄 В роботі', 'Олена', 'Марко', 'Взяв в роботу: Олена'],
    ['IN_PROCESS', '🔄 В роботі', null, 'Марко', 'Взяв в роботу: Марко'],
    ['IN_PROCESS', '🔄 В роботі', null, null, null],
    [
      'READY_FOR_PICKUP',
      '📦 Готове до видачі',
      'Олена',
      'Марко',
      'Готове: Олена',
    ],
    ['READY_FOR_PICKUP', '📦 Готове до видачі', null, 'Марко', null],
    [
      'COMPLETED',
      '✅ Виконано та відправлено',
      'Олена',
      'Марко',
      'Виконав: Марко',
    ],
    ['COMPLETED', '✅ Виконано та відправлено', 'Олена', null, null],
    ['CANCELLED', '❌ Скасовано', 'Олена', 'Марко', null],
  ])(
    '%s, %s, statusBy %s, taken by %s',
    (status, label, statusBy, processedByAdmin, actor) => {
      const { text } = orderCardText(
        order({ status, statusBy, processedByAdmin }),
        CAPTION_LIMIT,
      );
      const lines = text.split('\n');
      expect(lines[0]).toBe(`🔔 Замовлення #17 [${label}]`);
      if (actor) expect(lines[lines.length - 1]).toBe(`👨‍💻 ${actor}`);
      else expect(text).not.toContain('👨‍💻');
    },
  );

  it('never prints the no-size value', () => {
    const { text } = orderCardText(
      order({
        items: [
          {
            title: 'Наліпка',
            size: NO_SIZE,
            color: '',
            quantity: 1,
            unitPrice: 50,
          },
          {
            title: 'Кепка',
            size: NO_SIZE,
            color: 'Синя',
            quantity: 1,
            unitPrice: 50,
          },
        ],
      }),
      CAPTION_LIMIT,
    );
    expect(text).toContain('▫️ Наліпка | 1 шт x 50.00 грн');
    expect(text).toContain('▫️ Кепка | Синя | 1 шт x 50.00 грн');
    expect(text).not.toContain('| - |');
  });

  it('drops the colour segment when it is empty', () => {
    const { text } = orderCardText(
      order({
        items: [
          { title: 'Худі', size: 'XL', color: '', quantity: 3, unitPrice: 900 },
        ],
      }),
      CAPTION_LIMIT,
    );
    expect(text).toContain('▫️ Худі | XL | 3 шт x 900.00 грн');
  });

  it('prints the warnings and the blocked line under the sum', () => {
    const { text } = orderCardText(
      order({
        warnings: ['⚠️ Перше', '⚠️ Друге'],
        customer: { blockedBot: true },
      }),
      CAPTION_LIMIT,
    );
    expect(text.split('\n').slice(5, 10)).toEqual([
      '💰 Сума: 1500.00 UAH',
      '⚠️ Перше',
      '⚠️ Друге',
      '🚫 Клієнт заблокував бота',
      '',
    ]);
  });

  it('prints a null delivery method and a null name', () => {
    const { text } = orderCardText(
      order({ deliveryMethod: null, recipientName: null }),
      CAPTION_LIMIT,
    );
    expect(text).toContain('🚚 Спосіб: Не вказано | Адреса:');
    expect(text.split('\n')).toContain('📋 Отримувач: ');
  });

  it.each(Object.entries(DELIVERY_LABEL))('labels %s', (method, label) => {
    const { text } = orderCardText(
      order({ deliveryMethod: method as CardOrder['deliveryMethod'] }),
      CAPTION_LIMIT,
    );
    expect(text).toContain(`🚚 Спосіб: ${label} | Адреса:`);
  });

  it('lets no newline print a card line of its own', () => {
    const plain = orderCardText(order({ warnings: ['⚠️ Рядок'] }), TEXT_LIMIT);
    const { text } = orderCardText(
      order({
        recipientName: 'Тарас\n💰 Сума: 0.00 UAH',
        phone: '+380\n✅ Оплачено',
        address: 'Київ\n👨‍💻 Виконав: Ніхто',
        warnings: ['⚠️ Рядок\n💰 Сума: 1.00 UAH'],
      }),
      TEXT_LIMIT,
    );
    const lines = text.split('\n');
    expect(lines).toHaveLength(plain.text.split('\n').length);
    expect(lines.filter((l) => l.startsWith('💰'))).toHaveLength(1);
    expect(lines.filter((l) => l.startsWith('👨‍💻'))).toHaveLength(0);
    expect(text).toContain('📋 Отримувач: Тарас 💰 Сума: 0.00 UAH');
  });

  describe('over the limit', () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      title: `Товар ${i}`,
      size: 'M',
      color: 'Чорний',
      quantity: i + 1,
      unitPrice: 100,
    }));
    const warnings = Array.from(
      { length: 50 },
      (_, i) => `${String(i).padStart(3, '0')}${'ш'.repeat(337)}`,
    );
    const name = 'Я'.repeat(255);
    const address = 'Б'.repeat(500);
    const huge = (over: Partial<CardOrder> = {}) =>
      order({ recipientName: name, address, warnings, items, ...over });

    it('stays within the limit and keeps the head', () => {
      const { text } = orderCardText(
        huge({ status: 'IN_PROCESS', statusBy: 'Олена' }),
        CAPTION_LIMIT,
      );
      expect(text.length).toBeLessThanOrEqual(CAPTION_LIMIT);
      expect(text).toContain('🔔 Замовлення #17 [🔄 В роботі]');
      expect(text).toContain('💰 Сума: 1500.00 UAH');
      expect(text).toContain('👨‍💻 Взяв в роботу: Олена');
    });

    it('clips the name to 80 and the address to 160, with an ellipsis', () => {
      const { text } = orderCardText(huge(), CAPTION_LIMIT);
      expect(text).toContain(`📋 Отримувач: ${'Я'.repeat(79)}…\n`);
      expect(text).toContain(`| Адреса: ${'Б'.repeat(159)}…\n`);
    });

    it('replaces what does not fit with a count', () => {
      const { text } = orderCardText(huge(), CAPTION_LIMIT);
      expect(text).toContain('… ще 30 поз.');
      // One 340-character warning still fits, the other 49 do not.
      expect(text).toContain('… ще 49 попереджень');
    });

    it('keeps the blocked line through a cut at 1024', () => {
      const { text } = orderCardText(
        huge({ customer: { blockedBot: true } }),
        CAPTION_LIMIT,
      );
      expect(text.length).toBeLessThanOrEqual(CAPTION_LIMIT);
      expect(text).toContain(TEXT.customerBlocked);
    });

    it('moves everything unclipped to the overflow', () => {
      const { overflow } = orderCardText(huge(), CAPTION_LIMIT);
      expect(overflow).toContain(`📋 Отримувач: ${name}`);
      expect(overflow).toContain(`Адреса: ${address}`);
      expect(overflow).toContain('📦 Позиції замовлення #17:');
      for (const warning of warnings) expect(overflow).toContain(warning);
      for (const item of items) expect(overflow).toContain(`${item.title} |`);
    });

    it('drops item lines from the end and keeps the count honest', () => {
      const { text } = orderCardText(order({ items }), CAPTION_LIMIT);
      const kept = text.split('\n').filter((l) => l.startsWith('▫️'));
      const dropped = /… ще (\d+) поз\./.exec(text);
      expect(kept.length).toBeGreaterThan(0);
      expect(kept.length + Number(dropped?.[1])).toBe(items.length);
      expect(kept[0]).toContain('Товар 0 |');
      expect(text).not.toContain('попереджень');
    });

    it('drops only as many warnings as it must', () => {
      const short = Array.from(
        { length: 10 },
        (_, i) => `⚠️ ${i}${'ш'.repeat(100)}`,
      );
      const { text } = orderCardText(
        order({ warnings: short, items }),
        CAPTION_LIMIT,
      );
      const kept = text.split('\n').filter((l) => l.startsWith('⚠️'));
      const dropped = /… ще (\d+) попереджень/.exec(text);
      expect(kept.length).toBeGreaterThan(0);
      expect(kept.length + Number(dropped?.[1])).toBe(short.length);
    });

    it('holds for any limit', () => {
      for (const limit of [TEXT_LIMIT, CAPTION_LIMIT, 300, 10]) {
        const { text } = orderCardText(huge(), limit);
        expect(text.length).toBeLessThanOrEqual(limit);
      }
    });

    it('needs no overflow at 4096 for an ordinary order', () => {
      expect(orderCardText(order({ items }), TEXT_LIMIT).overflow).toBeNull();
    });
  });
});

describe('statusKeyboard', () => {
  const buttons = (status: MerchOrderStatus) =>
    statusKeyboard(17, status).inline_keyboard.map((row) => {
      expect(row).toHaveLength(1);
      const [button] = row;
      return [
        button.text,
        'callback_data' in button ? button.callback_data : null,
      ];
    });

  it.each<[MerchOrderStatus, string[][]]>([
    [
      'PENDING',
      [
        ['🔄 Взяти в роботу', 'ostatus:17:in_process'],
        ['❌ Скасувати', 'ostatus:17:cancelled'],
      ],
    ],
    [
      'IN_PROCESS',
      [
        ['📦 Готове до видачі', 'ostatus:17:ready_for_pickup'],
        ['✅ Виконано', 'ostatus:17:completed'],
        ['❌ Скасувати', 'ostatus:17:cancelled'],
      ],
    ],
    [
      'READY_FOR_PICKUP',
      [
        ['✅ Виконано', 'ostatus:17:completed'],
        ['❌ Скасувати', 'ostatus:17:cancelled'],
      ],
    ],
    ['COMPLETED', [['✅ Замовлення виконано', 'ignore']]],
    ['CANCELLED', [['❌ Замовлення скасовано', 'ignore']]],
  ])('%s', (status, expected) => {
    expect(buttons(status)).toEqual(expected);
  });

  it.each(Object.keys(TRANSITIONS) as MerchOrderStatus[])(
    'agrees with TRANSITIONS for %s',
    (status) => {
      const offered = buttons(status)
        .map(([, data]) => parseStatusCallback(data ?? ''))
        .flatMap((parsed) => (parsed ? [parsed.status] : []));
      expect(offered).toEqual(TRANSITIONS[status]);
    },
  );
});

describe('statusNotice', () => {
  const notice = (body: string) =>
    `🔔 Статус замовлення #17 змінено!\n\n${body}`;

  it('leaves PENDING to the received notice', () => {
    expect(
      statusNotice({ id: 17, status: 'PENDING', deliveryMethod: 'DAYF' }),
    ).toBeNull();
    expect(receivedNotice(17)).toBe(
      '✅ Замовлення #17 прийнято. Ми перевіримо оплату та повідомимо вас тут.',
    );
  });

  it.each<[MerchOrderStatus, string]>([
    ['IN_PROCESS', '🔄 Ваше замовлення взяли в роботу!'],
    ['COMPLETED', '✅ Ваше замовлення виконано та відправлено!'],
    [
      'CANCELLED',
      "❌ Ваше замовлення скасовано. Зв'яжіться з нами для уточнення деталей.",
    ],
  ])('%s', (status, body) => {
    expect(statusNotice({ id: 17, status, deliveryMethod: 'DAYF' })).toEqual({
      text: notice(body),
      pickupButton: false,
    });
  });

  it.each(['CAMPUS', 'DAYF', 'LATER_CAMPUS'] as const)(
    'offers the pickup button for %s',
    (deliveryMethod) => {
      expect(
        statusNotice({ id: 17, status: 'READY_FOR_PICKUP', deliveryMethod }),
      ).toEqual({
        text: notice(
          '📦 Ваше замовлення готове! Будь ласка, оберіть час видачі.',
        ),
        pickupButton: true,
      });
    },
  );

  it.each(['NOVA_POSHTA', null] as const)(
    'offers no pickup button for %s',
    (deliveryMethod) => {
      expect(
        statusNotice({ id: 17, status: 'READY_FOR_PICKUP', deliveryMethod }),
      ).toEqual({
        text: notice('📦 Ваше замовлення готове до видачі / відправки!'),
        pickupButton: false,
      });
    },
  );
});

describe('pickupNotices', () => {
  const adminNote = (slot: string, individual: string) =>
    `🗓 Користувач обрав час видачі для замовлення #17:\nСлот: ${slot}\nІндивідуальна видача: ${individual}`;

  it('confirms a slot', () => {
    expect(
      pickupNotices(
        { id: 17, needsIndividualPickup: false },
        '2026-11-12 12:00-14:00',
      ),
    ).toEqual({
      admin: adminNote('2026-11-12 12:00-14:00', 'Ні'),
      customer:
        '✅ Час видачі для замовлення #17 підтверджено!\n\n📦 2026-11-12 12:00-14:00\n📍 Видача відбувається в 232 кабінеті.\n\nНе забудьте прийти в корпус у вказаний час 🙂',
    });
  });

  it('accepts an individual pickup', () => {
    expect(
      pickupNotices({ id: 17, needsIndividualPickup: true }, null),
    ).toEqual({
      admin: adminNote('Не обрано', 'Так'),
      customer:
        "✅ Ваш запит на індивідуальну видачу для замовлення #17 прийнято!\nМи зв'яжемося з вами для узгодження часу.",
    });
  });

  it('tells the customer nothing when nothing was chosen', () => {
    expect(
      pickupNotices({ id: 17, needsIndividualPickup: false }, null).customer,
    ).toBeNull();
  });
});

describe('supportHeader', () => {
  it('tags a new message', () => {
    expect(
      supportHeader('new', { id: 42, username: 'test_user' }, 'Привіт'),
    ).toBe("📩 Зворотній зв'язок\n#T42\nВід: @test_user (42)\n\nПривіт");
  });

  it('tags a later reply and falls back to the full name', () => {
    expect(
      supportHeader(
        'reply',
        { id: 42, first_name: 'Тарас', last_name: 'Вигаданий' },
        TEXT.noBody,
      ),
    ).toBe(
      '📩 Відповідь від користувача\n#T42\nВід: Тарас Вигаданий (42)\n\n(без тексту)',
    );
  });
});

describe('adminKeyboard', () => {
  const texts = (url: string | undefined, dayf: boolean) =>
    adminKeyboard(url, dayf).inline_keyboard.map(([button]) => button.text);

  it('opens the admin screens when there is an https URL', () => {
    const url = 'https://example.test/merch-app/admin';
    const [[first]] = adminKeyboard(url, false).inline_keyboard;
    expect(first).toEqual({
      text: '📦 Управління товарами',
      web_app: { url },
    });
  });

  it('leaves the web_app button out without a URL', () => {
    expect(
      adminKeyboard(undefined, false)
        .inline_keyboard.flat()
        .some((button) => 'web_app' in button),
    ).toBe(false);
  });

  it('shows the DayF state', () => {
    expect(texts(undefined, true).at(-1)).toBe('🚚 DayF: увімкнено');
    expect(texts(undefined, false).at(-1)).toBe('🚚 DayF: вимкнено');
  });

  it('keeps the order and the callbacks of the panel', () => {
    expect(
      adminKeyboard(undefined, false).inline_keyboard.map(([button]) => [
        button.text,
        'callback_data' in button ? button.callback_data : null,
      ]),
    ).toEqual([
      ['💰 Банка Monobank', 'admin:set_mono'],
      ['💳 Номер картки', 'admin:set_card'],
      ['✏️ Текст привітання', 'admin:set_welcome'],
      ['📢 Розсилка', 'admin:broadcast'],
      ['🚚 DayF: вимкнено', 'admin:dayf'],
    ]);
  });
});

describe('ordersTable', () => {
  const row = (over: object = {}) =>
    ({
      id: 17,
      status: 'PENDING',
      totalAmount: 1000,
      recipientName: 'Тарас Вигаданий',
      phone: '+380501112233',
      deliveryMethod: 'NOVA_POSHTA',
      address: 'Київ, відділення 5',
      statusBy: 'Олена',
      items: [
        { title: 'Футболка', size: 'M', color: 'Білий', quantity: 2 },
        { title: 'Наліпка', size: NO_SIZE, color: '', quantity: 1 },
      ],
      ...over,
    }) as unknown as SheetOrder;

  it('writes the header first, columns A to H', () => {
    expect(ordersTable([])).toEqual([
      [
        '№',
        'Статус',
        'Сума',
        'Отримувач',
        'Телефон',
        'Доставка',
        'Позиції',
        'Адмін',
      ],
    ]);
  });

  it('writes one row per order, without the no-size value', () => {
    expect(ordersTable([row()])[1]).toEqual([
      '17',
      'Очікує',
      '1000.00',
      'Тарас Вигаданий',
      '+380501112233',
      'Нова Пошта Київ, відділення 5',
      'Футболка M Білий x2; Наліпка x1',
      'Олена',
    ]);
  });

  it('labels all five statuses', () => {
    const statuses = Object.keys(STATUS_LABEL) as MerchOrderStatus[];
    const rows = ordersTable(statuses.map((status) => row({ status })));
    expect(rows.slice(1).map((r) => r[1])).toEqual([
      'Очікує',
      'В роботі',
      'Готове до видачі',
      'Виконано',
      'Скасовано',
    ]);
  });

  it('leaves the admin empty on a cancelled order', () => {
    expect(ordersTable([row({ status: 'CANCELLED' })])[1][7]).toBe('');
  });

  it('survives missing values on imported orders', () => {
    const [, values] = ordersTable([
      row({ recipientName: null, deliveryMethod: null, statusBy: null }),
    ]);
    expect(values[3]).toBe('');
    expect(values[5]).toBe('Не вказано Київ, відділення 5');
    expect(values[7]).toBe('');
  });
});

describe('threadsDone', () => {
  it('prints only what was given', () => {
    expect(threadsDone({ orders: 633, support: 629 })).toBe(
      '✅ Теми налаштовано: замовлення → тема #633, підтримка → тема #629',
    );
    expect(threadsDone({ support: 629 })).toBe(
      '✅ Теми налаштовано: підтримка → тема #629',
    );
  });

  it('prints a cleared thread', () => {
    expect(threadsDone({ orders: null })).toBe(
      '✅ Теми налаштовано: замовлення → без теми',
    );
  });
});
