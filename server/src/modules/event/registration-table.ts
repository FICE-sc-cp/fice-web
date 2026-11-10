import type {
  EventQuestion,
  EventRegistration,
  EventRegistrationAnswer,
  RegistrationPayment,
  RegistrationSource,
} from '@prisma/client';
import { cleanFileName, parseFileAnswer } from './registration-answers';

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

export interface LinkList {
  links: { label: string; uri: string }[];
}

export type TableCell = string | LinkList;

export type RegistrationTable = [string[], ...TableCell[][]];

export function cellText(cell: TableCell): string {
  return typeof cell === 'string'
    ? cell
    : cell.links.map((link) => link.label).join('\n');
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
): RegistrationTable {
  const site = webUrl.replace(/\/+$/, '');
  const absolute = (url: string) =>
    url && !/^https?:\/\//.test(url) ? `${site}${url}` : url;
  const answerCell = (value: string): TableCell => {
    const files = parseFileAnswer(value);
    return files
      ? {
          links: files.map((f, i) => ({
            label: cleanFileName(f.name, i),
            uri: absolute(f.url),
          })),
        }
      : value;
  };
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
  const rows = event.registrations.map((reg): TableCell[] => {
    const answers = new Map(reg.answers.map((a) => [a.questionId, a.value]));
    return [
      reg.fullName,
      reg.telegramTag,
      reg.group,
      reg.birthDate ? calendarDay.format(reg.birthDate) : '',
      reg.phoneNumber ?? '',
      SOURCE_LABEL[reg.source],
      PAYMENT_LABEL[reg.payment],
      paymentStatus(reg),
      absolute(reg.receiptUrl ?? ''),
      // The number printed under the QR on the ticket.
      reg.ticketCode.slice(0, 8).toUpperCase(),
      kyivTime.format(reg.createdAt),
      reg.attended ? PRESENT : EXPECTED,
      reg.attendedAt ? kyivTime.format(reg.attendedAt) : '',
      reg.attendedBy ?? '',
      ...event.questions.map((q) => answerCell(answers.get(q.id) ?? '')),
    ];
  });
  return [header, ...rows];
}
