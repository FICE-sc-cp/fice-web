import { kyivWallTime } from '../event/event-timing';
import { normalizeTelegramUsername } from '../event/registration-identity';

/** Candidates can't book, or move away from, a slot starting sooner than this. */
export const BOOKING_LEAD_MS = 60 * 60_000;
export const REMINDER_BEFORE_MS = 10 * 60_000;
export const MAX_DEPARTMENTS_PER_CANDIDATE = 2;
export const MAX_SLOTS_PER_BATCH = 48;

export type StaffRole = 'HEAD' | 'RECRUITER' | 'ADMIN';

export interface Span {
  startsAt: Date;
  endsAt: Date;
}

/** "@Name", "name" or "t.me/name" → "name"; null when it is not a username. */
export function tagUsername(raw?: string | null): string | null {
  return normalizeTelegramUsername(
    (raw ?? '').trim().replace(/^(https?:\/\/)?t\.me\//i, ''),
  );
}

export function overlaps(a: Span, b: Span): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

/** Splits a Kyiv-time window ("2026-10-20", "14:00"–"16:00") into back-to-back slots. */
export function splitWindow(
  date: string,
  from: string,
  to: string,
  minutes: number,
): Span[] {
  const [y, m, d] = date.split('-').map(Number);
  const [fromH, fromM] = from.split(':').map(Number);
  const [toH, toM] = to.split(':').map(Number);
  const end = kyivWallTime(y, m, d, toH, toM).getTime();
  const step = minutes * 60_000;
  const spans: Span[] = [];
  for (
    let t = kyivWallTime(y, m, d, fromH, fromM).getTime();
    t + step <= end;
    t += step
  ) {
    spans.push({ startsAt: new Date(t), endsAt: new Date(t + step) });
  }
  return spans;
}

/**
 * Role per department: the department head (by the tag set in the admin panel)
 * manages it, added recruiters interview in it, presidium members interview in
 * every department.
 */
export function staffRoles(
  username: string | null,
  departments: { id: string; head: { telegramTag: string | null } | null }[],
  recruiterDepartmentIds: string[],
  isAdmin: boolean,
): Map<string, StaffRole> {
  const roles = new Map<string, StaffRole>();
  for (const dept of departments) {
    if (username && tagUsername(dept.head?.telegramTag) === username) {
      roles.set(dept.id, 'HEAD');
    } else if (recruiterDepartmentIds.includes(dept.id)) {
      roles.set(dept.id, 'RECRUITER');
    } else if (isAdmin) {
      roles.set(dept.id, 'ADMIN');
    }
  }
  return roles;
}

/** Why a candidate can't take `target` (moving from `current`), or null. */
export function bookingProblem(
  now: Date,
  target: Span,
  current: Span | null,
  otherBookings: Span[],
): string | null {
  const lockedUntil = now.getTime() + BOOKING_LEAD_MS;
  if (current && current.startsAt.getTime() <= lockedUntil) {
    return 'Змінити час можна не пізніше ніж за годину до співбесіди';
  }
  if (target.startsAt.getTime() <= lockedUntil) {
    return 'Записатися можна не пізніше ніж за годину до початку';
  }
  if (otherBookings.some((b) => overlaps(b, target))) {
    return 'На цей час у тебе вже є інша співбесіда';
  }
  return null;
}
