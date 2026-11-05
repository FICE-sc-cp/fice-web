import type {
  MerchDeliveryMethod,
  MerchOrder,
  MerchOrderItem,
  MerchOrderStatus,
} from '@prisma/client';
import type { InlineKeyboardMarkup } from 'grammy/types';
import {
  isPickupDelivery,
  oneLine,
  optionsLabel,
  TRANSITIONS,
} from './merch-rules';

export const STATUS_LABEL: Record<MerchOrderStatus, string> = {
  PENDING: 'Очікує',
  IN_PROCESS: 'В роботі',
  READY_FOR_PICKUP: 'Готове до видачі',
  COMPLETED: 'Виконано',
  CANCELLED: 'Скасовано',
};

export const CARD_LABEL: Record<MerchOrderStatus, string> = {
  PENDING: '🕐 Очікує',
  IN_PROCESS: '🔄 В роботі',
  READY_FOR_PICKUP: '📦 Готове до видачі',
  COMPLETED: '✅ Виконано та відправлено',
  CANCELLED: '❌ Скасовано',
};

export const DELIVERY_LABEL: Record<MerchDeliveryMethod, string> = {
  NOVA_POSHTA: 'Нова Пошта',
  CAMPUS: 'На DayF',
  DAYF: 'DayF',
  LATER_CAMPUS: 'В корпусі',
};

const START_HINT =
  "💬 Для зв'язку з адміністрацією або залишення зворотного зв'язку, натисніть кнопку «Підтримка» нижче або використовуйте команду /support.";

/** Every fixed bot string. Plain text, no parse_mode anywhere. */
export const TEXT = {
  startHint: START_HINT,
  startNoProducts: `Передзамовлення недоступне.\n${START_HINT}`,
  supportButton: '💬 Підтримка',
  catalogButton: '🛍 Відкрити каталог',
  supportPromptButton: 'Напишіть ваше повідомлення для адміністраторів:',
  supportPromptCommand:
    'Напишіть ваше повідомлення для адміністраторів (можна прикріпити фото):',
  supportSent: '✅ Ваше повідомлення надіслано адміністраторам!',
  supportFailed:
    'Не вдалося надіслати повідомлення. Спробуйте ще раз за хвилину.',
  noAdminChat: 'Помилка: чат адміністраторів не налаштований.',
  noBody: '(без тексту)',
  adminAnswerPrefix: '💬 Відповідь від адміністратора:\n\n',
  replyBlocked: '⚠️ Не доставлено: клієнт заблокував бота.',
  replyFailed: '⚠️ Не вдалося доставити, спробуйте ще раз.',
  bindDone: "✅ Цю групу успішно прив'язано як адмін-чат.",
  bindDenied: "Недостатньо прав для прив'язки адмін-чату.",
  threadsUsage:
    'Використання: /setthreads orders:<thread_id> support:<thread_id>\nНаприклад: /setthreads orders:633 support:629',
  threadsNotBound: "Спочатку прив'яжіть цей чат командою /bind_admin_chat",
  panel: '🔧 Панель адміністратора:',
  panelDenied: 'У вас немає доступу до панелі адміністратора.',
  commandDenied: 'У вас немає доступу до цієї команди.',
  monoPrompt: 'Введіть нове посилання на Банку Monobank:',
  monoDone: '✅ Посилання на банку оновлено!',
  monoInvalid: 'Посилання має починатися з https://',
  cardPrompt: 'Введіть новий номер картки (або відправте 0 щоб видалити):',
  cardDone: '✅ Номер картки оновлено!',
  cardInvalid: 'Номер картки: лише цифри, до 20 символів, або 0 щоб видалити.',
  welcomePrompt: 'Введіть новий текст привітання для користувачів:',
  welcomeDone: '✅ Текст привітання оновлено!',
  textRequired: 'Надішліть текст.',
  cancelButton: 'Скасувати',
  cancelled: 'Скасовано.',
  somethingWrong: 'Щось пішло не так, спробуй ще раз.',
  broadcastPrompt:
    '📢 Введіть текст або надішліть фото з підписом для розсилки.\n\nПовідомлення буде надіслано користувачам, які мають хоча б одне нескасоване замовлення.',
  broadcastSendButton: '✅ Надіслати',
  broadcastExpired: 'Час вийшов, розсилку не запущено.',
  broadcastRunning: 'Розсилка вже йде. Дочекайтесь звіту.',
  broadcastUncopyable:
    'Це повідомлення не можна надіслати. Спробуйте текст або фото.',
  clearYesButton: '🗑 Так, видалити',
  clearDone:
    '✅ Всі замовлення було успішно видалено з бази даних та таблиці Google Sheets.',
  clearExpired: 'Час вийшов, нічого не видалено.',
  orderMissing: 'Замовлення не знайдено',
  sameStatus: 'Цей статус вже встановлено',
  terminalStatus: 'Замовлення вже завершено',
  wrongChat: 'Цю кнопку можна натискати лише в адмін-чаті.',
  linkOffer:
    'Підтвердіть вхід на сайт мерчу ФІОТ. Після цього ви зможете оформити замовлення, а статус приходитиме сюди.\n\nЯкщо ви не відкривали сайт, просто проігноруйте це повідомлення.',
  linkConfirmButton: '✅ Підтвердити',
  linkDone: '✅ Готово! Поверніться на сайт, сторінка оновиться сама.',
  linkNotMeButton: 'Це був не я',
  linkRevoked: 'Усі входи на сайт скасовано.',
  linkStale:
    'Посилання застаріло. Поверніться на сайт і натисніть кнопку ще раз.',
  itemLink: 'Відкрийте товар у каталозі:',
  itemButton: '🛍 Відкрити товар',
  pickupButton: '🗓 Обрати час видачі',
  receiptMissing: '⚠️ Квитанцію не вдалося прикласти',
  customerBlocked: '🚫 Клієнт заблокував бота',
  dayfOff: '⚠️ DayF вимкнено, клієнт обрав його до вимкнення',
};

/** `/setthreads` answer: each part only if given, a cleared thread prints `без теми`. */
export function threadsDone(threads: {
  orders?: number | null;
  support?: number | null;
}): string {
  const part = (name: string, id: number | null | undefined) =>
    id === undefined
      ? []
      : [`${name} → ${id === null ? 'без теми' : `тема #${id}`}`];
  const parts = [
    ...part('замовлення', threads.orders),
    ...part('підтримка', threads.support),
  ];
  return `✅ Теми налаштовано: ${parts.join(', ')}`;
}

export const statusChanged = (status: MerchOrderStatus) =>
  `Статус змінено: ${CARD_LABEL[status]}`;
export const statusStale = (status: MerchOrderStatus) =>
  `Статус уже змінено: ${CARD_LABEL[status]}`;
export const clearAsk = (n: number) =>
  `Видалити всі замовлення (${n}) з бази і таблиці? Скасувати це неможливо.`;
export const broadcastAsk = (n: number) =>
  `Надіслати це повідомлення отримувачам: ${n}?`;
export const broadcastStarted = (n: number) =>
  `📢 Розсилку запущено — отримувачів: ${n}. Звіт надійде після завершення.`;
export const broadcastFinished = (sent: number, failed: number) =>
  `📢 Розсилку завершено!\n✅ Надіслано: ${sent}\n❌ Не вдалося: ${failed}`;
export const broadcastStopped = (sent: number, total: number) =>
  `⚠️ Розсилку перервано перезапуском. Надіслано ${sent} з ${total}.`;

export interface CardOrder {
  id: number;
  status: MerchOrderStatus;
  telegramId: bigint;
  recipientName: string | null;
  phone: string;
  deliveryMethod: MerchDeliveryMethod | null;
  address: string;
  totalAmount: { toFixed(n: number): string };
  currency: string;
  warnings: string[];
  processedByAdmin: string | null;
  statusBy: string | null;
  customer: { blockedBot: boolean };
  items: {
    title: string;
    size: string;
    color: string;
    quantity: number;
    unitPrice: { toFixed(n: number): string };
  }[];
}

const deliveryName = (m: MerchDeliveryMethod | null) =>
  m ? DELIVERY_LABEL[m] : 'Не вказано';

const clip = (s: string, max: number) =>
  s.length <= max ? s : `${s.slice(0, max - 1)}…`;

function itemLine(item: CardOrder['items'][number]): string {
  const parts = [
    item.title,
    optionsLabel(item.size, item.color, ' | '),
    `${item.quantity} шт x ${item.unitPrice.toFixed(2)} грн`,
  ];
  return `▫️ ${parts.filter(Boolean).join(' | ')}`;
}

function actorLine(o: CardOrder): string | null {
  const line = (label: string, name: string | null) =>
    name ? `👨‍💻 ${label}: ${name}` : null;
  if (o.status === 'IN_PROCESS') {
    return line('Взяв в роботу', o.statusBy ?? o.processedByAdmin);
  }
  if (o.status === 'READY_FOR_PICKUP') return line('Готове', o.statusBy);
  if (o.status === 'COMPLETED') return line('Виконав', o.processedByAdmin);
  return null;
}

/** Whole card rebuilt from the row. text.length <= limit for any input; what does not fit goes to overflow. */
export function orderCardText(
  order: CardOrder,
  limit: number,
): { text: string; overflow: string | null } {
  const name = oneLine(order.recipientName ?? '');
  const address = oneLine(order.address);
  const warnings = order.warnings.map(oneLine);
  const items = order.items.map(itemLine);
  const actor = actorLine(order);
  const recipientRow = (who: string) => `📋 Отримувач: ${who}`;
  const deliveryRow = (where: string) =>
    `🚚 Спосіб: ${deliveryName(order.deliveryMethod)} | Адреса: ${where}`;

  const card = (
    who: string,
    where: string,
    warned: string[],
    listed: string[],
  ) =>
    [
      `🔔 Замовлення #${order.id} [${CARD_LABEL[order.status]}]`,
      `👤 Клієнт: tg://user?id=${order.telegramId} (${order.telegramId})`,
      recipientRow(who),
      `📞 Телефон: ${oneLine(order.phone)}`,
      deliveryRow(where),
      `💰 Сума: ${order.totalAmount.toFixed(2)} ${order.currency}`,
      ...warned,
      ...(order.customer.blockedBot ? [TEXT.customerBlocked] : []),
      '',
      '📦 Позиції:',
      ...listed,
      ...(actor ? [actor] : []),
    ].join('\n');

  const whole = card(name, address, warnings, items);
  if (whole.length <= limit) return { text: whole, overflow: null };

  const who = clip(name, 80);
  const where = clip(address, 160);
  let listed = items;
  for (let n = 1; n <= items.length; n++) {
    if (card(who, where, warnings, listed).length <= limit) break;
    listed = [...items.slice(0, -n), `… ще ${n} поз.`];
  }
  let warned = warnings;
  for (let n = 1; n <= warnings.length; n++) {
    if (card(who, where, warned, listed).length <= limit) break;
    warned = [...warnings.slice(0, -n), `… ще ${n} попереджень`];
  }
  return {
    text: card(who, where, warned, listed).slice(0, limit),
    overflow: [
      recipientRow(name),
      deliveryRow(address),
      ...warnings,
      `📦 Позиції замовлення #${order.id}:`,
      ...items,
    ].join('\n'),
  };
}

const NEXT_BUTTON: Record<MerchOrderStatus, string> = {
  PENDING: '',
  IN_PROCESS: '🔄 Взяти в роботу',
  READY_FOR_PICKUP: '📦 Готове до видачі',
  COMPLETED: '✅ Виконано',
  CANCELLED: '❌ Скасувати',
};

/** One button per row, built from TRANSITIONS; a finished order gets one `ignore` button. */
export function statusKeyboard(
  orderId: number,
  status: MerchOrderStatus,
): InlineKeyboardMarkup {
  if (status === 'COMPLETED' || status === 'CANCELLED') {
    const text =
      status === 'COMPLETED'
        ? '✅ Замовлення виконано'
        : '❌ Замовлення скасовано';
    return { inline_keyboard: [[{ text, callback_data: 'ignore' }]] };
  }
  return {
    inline_keyboard: TRANSITIONS[status].map((to) => [
      {
        text: NEXT_BUTTON[to],
        callback_data: `ostatus:${orderId}:${to.toLowerCase()}`,
      },
    ]),
  };
}

/** The customer's message for a status; null for PENDING, which gets receivedNotice. */
export function statusNotice(o: {
  id: number;
  status: MerchOrderStatus;
  deliveryMethod: MerchDeliveryMethod | null;
}): { text: string; pickupButton: boolean } | null {
  const pickup = isPickupDelivery(o.deliveryMethod);
  const notices: Partial<Record<MerchOrderStatus, string>> = {
    IN_PROCESS: '🔄 Ваше замовлення взяли в роботу!',
    READY_FOR_PICKUP: pickup
      ? '📦 Ваше замовлення готове! Будь ласка, оберіть час видачі.'
      : '📦 Ваше замовлення готове до видачі / відправки!',
    COMPLETED: '✅ Ваше замовлення виконано та відправлено!',
    CANCELLED:
      "❌ Ваше замовлення скасовано. Зв'яжіться з нами для уточнення деталей.",
  };
  const notice = notices[o.status];
  if (!notice) return null;
  return {
    text: `🔔 Статус замовлення #${o.id} змінено!\n\n${notice}`,
    pickupButton: o.status === 'READY_FOR_PICKUP' && pickup,
  };
}

export const receivedNotice = (orderId: number): string =>
  `✅ Замовлення #${orderId} прийнято. Ми перевіримо оплату та повідомимо вас тут.`;

/** The admin note and the customer's confirmation of a pickup choice. */
export function pickupNotices(
  o: { id: number; needsIndividualPickup: boolean },
  slot: string | null,
): { admin: string; customer: string | null } {
  const admin =
    `🗓 Користувач обрав час видачі для замовлення #${o.id}:\n` +
    `Слот: ${slot ?? 'Не обрано'}\n` +
    `Індивідуальна видача: ${o.needsIndividualPickup ? 'Так' : 'Ні'}`;
  if (slot) {
    return {
      admin,
      customer: `✅ Час видачі для замовлення #${o.id} підтверджено!\n\n📦 ${slot}\n📍 Видача відбувається в 232 кабінеті.\n\nНе забудьте прийти в корпус у вказаний час 🙂`,
    };
  }
  return {
    admin,
    customer: o.needsIndividualPickup
      ? `✅ Ваш запит на індивідуальну видачу для замовлення #${o.id} прийнято!\nМи зв'яжемося з вами для узгодження часу.`
      : null,
  };
}

/** Routing lives in the `#T<id>` line: supportTarget reads it back from the replied message. */
export function supportHeader(
  kind: 'new' | 'reply',
  user: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  },
  body: string,
): string {
  const first =
    kind === 'new' ? "📩 Зворотній зв'язок" : '📩 Відповідь від користувача';
  const from = user.username
    ? `@${user.username}`
    : [user.first_name, user.last_name].filter(Boolean).join(' ');
  return `${first}\n#T${user.id}\nВід: ${from} (${user.id})\n\n${body}`;
}

/** `appUrl` is the full admin screen URL, `bot.appUrl('/admin')`; without one that button is left out. */
export function adminKeyboard(
  appUrl: string | undefined,
  dayfEnabled: boolean,
): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      ...(appUrl
        ? [[{ text: '📦 Управління товарами', web_app: { url: appUrl } }]]
        : []),
      [{ text: '💰 Банка Monobank', callback_data: 'admin:set_mono' }],
      [{ text: '💳 Номер картки', callback_data: 'admin:set_card' }],
      [{ text: '✏️ Текст привітання', callback_data: 'admin:set_welcome' }],
      [{ text: '📢 Розсилка', callback_data: 'admin:broadcast' }],
      [
        {
          text: `🚚 DayF: ${dayfEnabled ? 'увімкнено' : 'вимкнено'}`,
          callback_data: 'admin:dayf',
        },
      ],
    ],
  };
}

export type SheetOrder = MerchOrder & { items: MerchOrderItem[] };

/** Header first, columns A to H only, so a column the owner adds to the right survives. */
export function ordersTable(orders: SheetOrder[]): string[][] {
  return [
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
    ...orders.map((o) => [
      String(o.id),
      STATUS_LABEL[o.status],
      o.totalAmount.toFixed(2),
      o.recipientName ?? '',
      o.phone,
      `${deliveryName(o.deliveryMethod)} ${o.address}`,
      o.items
        .map((i) =>
          [i.title, optionsLabel(i.size, i.color, ' '), `x${i.quantity}`]
            .filter(Boolean)
            .join(' '),
        )
        .join('; '),
      o.status === 'CANCELLED' ? '' : (o.statusBy ?? ''),
    ]),
  ];
}
