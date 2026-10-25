import type {
  EventQuestion,
  EventRegistration,
  EventRegistrationAnswer,
  RegistrationPayment,
  RegistrationSource,
} from '@prisma/client';

const PAYMENT_LABEL: Record<RegistrationPayment, string> = {
  NONE: '—',
  DONATED: 'Задонатив',
  AT_EVENT: 'На заході',
};

const SOURCE_LABEL: Record<RegistrationSource, string> = {
  WEB: 'Сайт',
  BOT: 'Telegram-бот',
  ADMIN: 'Додано вручну',
};

export const PRESENT = 'Присутній';
export const EXPECTED = 'Очікується';

const kyivTime = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Kyiv',
});

// Birth dates are stored as UTC midnight.
const calendarDay = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

export interface RegistrationTableEvent {
  questions: Pick<EventQuestion, 'id' | 'label'>[];
  registrations: (EventRegistration & {
    answers: Pick<EventRegistrationAnswer, 'questionId' | 'value'>[];
  })[];
}

function paymentStatus(reg: EventRegistration): string {
  switch (reg.paymentStatus) {
    case 'CONFIRMED':
      return 'Підтверджено';
    case 'REJECTED':
      return `Відхилено${reg.paymentRejectionReason ? `: ${reg.paymentRejectionReason}` : ''}`;
    case 'PENDING':
      return 'Очікує підтвердження';
    default:
      return '—';
  }
}

/**
 * The header row and one row per registration for the event's Google Sheets
 * tab. Receipts become full links to the site.
 */
export function registrationTable(
  event: RegistrationTableEvent,
  webUrl = '',
): string[][] {
  const site = webUrl.replace(/\/+$/, '');
  const header = [
    'ПІБ',
    'Telegram',
    'Група',
    'Дата народження',
    'Телефон',
    'Джерело',
    'Оплата',
    'Статус оплати',
    'Скрін/Чек',
    'Код квитка',
    'Зареєстровано',
    'Присутність',
    'Час відмітки',
    'Хто відмітив',
    ...event.questions.map((q) => q.label),
  ];
  const rows = event.registrations.map((reg) => {
    const answers = new Map(reg.answers.map((a) => [a.questionId, a.value]));
    const receipt = reg.receiptUrl ?? '';
    return [
      reg.fullName,
      reg.telegramTag,
      reg.group,
      reg.birthDate ? calendarDay.format(reg.birthDate) : '',
      reg.phoneNumber ?? '',
      SOURCE_LABEL[reg.source],
      PAYMENT_LABEL[reg.payment],
      paymentStatus(reg),
      receipt && !/^https?:\/\//.test(receipt) ? `${site}${receipt}` : receipt,
      // The number printed under the QR on the ticket.
      reg.ticketCode.slice(0, 8).toUpperCase(),
      kyivTime.format(reg.createdAt),
      reg.attended ? PRESENT : EXPECTED,
      reg.attendedAt ? kyivTime.format(reg.attendedAt) : '',
      reg.attendedBy ?? '',
      ...event.questions.map((q) => answers.get(q.id) ?? ''),
    ];
  });
  return [header, ...rows];
}
