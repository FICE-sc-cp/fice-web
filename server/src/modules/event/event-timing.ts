import type { Prisma } from '@prisma/client';

export const EVENT_TIME_ZONE = 'Europe/Kyiv';

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: EVENT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function kyivParts(at: Date) {
  const parts: Record<string, number> = {};
  for (const p of partsFormatter.formatToParts(at)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return parts as Record<
    'year' | 'month' | 'day' | 'hour' | 'minute' | 'second',
    number
  >;
}

function kyivOffsetMs(at: Date): number {
  const p = kyivParts(at);
  const wallClockAsUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return wallClockAsUtc - Math.floor(at.getTime() / 1000) * 1000;
}

function kyivMidnight(year: number, month: number, day: number): Date {
  const wallClock = Date.UTC(year, month - 1, day);
  let instant = wallClock - kyivOffsetMs(new Date(wallClock));
  instant = wallClock - kyivOffsetMs(new Date(instant));
  return new Date(instant);
}

export function startOfKyivDay(at: Date): Date {
  const p = kyivParts(at);
  return kyivMidnight(p.year, p.month, p.day);
}

export function endOfKyivDay(at: Date): Date {
  const p = kyivParts(at);
  return kyivMidnight(p.year, p.month, p.day + 1);
}

export interface EventTiming {
  date: Date;
  hasTime: boolean;
  registrationCloseDate: Date | null;
  noRegistration: boolean;
  isDraft: boolean;
  maxRegistrations: number | null;
}

export type RegistrationClosedReason =
  | 'draft'
  | 'noRegistration'
  | 'deadline'
  | 'capacity';

export function upcomingUntil(event: Pick<EventTiming, 'date' | 'hasTime'>) {
  return event.hasTime ? event.date : endOfKyivDay(event.date);
}

export function isEventPast(
  event: Pick<EventTiming, 'date' | 'hasTime'>,
  now: Date,
): boolean {
  return now.getTime() >= upcomingUntil(event).getTime();
}

export function registrationDeadline(
  event: Pick<EventTiming, 'date' | 'hasTime' | 'registrationCloseDate'>,
): Date {
  return event.registrationCloseDate ?? upcomingUntil(event);
}

export function registrationClosedReason(
  event: EventTiming,
  registeredCount: number,
  now: Date,
): RegistrationClosedReason | null {
  if (event.isDraft) return 'draft';
  if (event.noRegistration) return 'noRegistration';
  if (now.getTime() >= registrationDeadline(event).getTime()) {
    return 'deadline';
  }
  if (
    event.maxRegistrations &&
    event.maxRegistrations > 0 &&
    registeredCount >= event.maxRegistrations
  ) {
    return 'capacity';
  }
  return null;
}

export function registrationClosedMessage(
  reason: RegistrationClosedReason,
  event: Pick<EventTiming, 'maxRegistrations'>,
): string {
  switch (reason) {
    case 'capacity':
      return `Реєстрацію закрито: досягнуто ліміт у ${event.maxRegistrations} учасників`;
    case 'deadline':
      return 'Реєстрацію на цей захід закрито';
    default:
      return 'Реєстрація на цей захід недоступна';
  }
}

export function upcomingEventsWhere(now: Date): Prisma.EventWhereInput {
  return {
    OR: [
      { hasTime: true, date: { gte: now } },
      { hasTime: false, date: { gte: startOfKyivDay(now) } },
    ],
  };
}

export function pastEventsWhere(now: Date): Prisma.EventWhereInput {
  return {
    OR: [
      { hasTime: true, date: { lt: now } },
      { hasTime: false, date: { lt: startOfKyivDay(now) } },
    ],
  };
}

export function withRegistrationState<
  T extends EventTiming & { _count?: { registrations?: number } },
>(event: T, now: Date = new Date()) {
  const reason = registrationClosedReason(
    event,
    event._count?.registrations ?? 0,
    now,
  );
  return {
    ...event,
    isPast: isEventPast(event, now),
    registrationClosesAt: event.noRegistration
      ? null
      : registrationDeadline(event),
    registrationOpen: reason === null,
  };
}
