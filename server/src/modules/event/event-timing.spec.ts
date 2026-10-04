import {
  endOfKyivDay,
  isEventPast,
  pastEventsWhere,
  registrationClosedReason,
  registrationDeadline,
  startOfKyivDay,
  upcomingEventsWhere,
  withRegistrationState,
} from './event-timing';

const base = {
  hasTime: true,
  registrationCloseDate: null,
  noRegistration: false,
  isDraft: false,
  maxRegistrations: null,
};

describe('Kyiv day boundaries', () => {
  it('handles summer time (UTC+3)', () => {
    const at = new Date('2026-07-10T12:00:00Z');
    expect(startOfKyivDay(at).toISOString()).toBe('2026-07-09T21:00:00.000Z');
    expect(endOfKyivDay(at).toISOString()).toBe('2026-07-10T21:00:00.000Z');
  });

  it('handles winter time (UTC+2)', () => {
    const at = new Date('2026-12-10T12:00:00Z');
    expect(startOfKyivDay(at).toISOString()).toBe('2026-12-09T22:00:00.000Z');
    expect(endOfKyivDay(at).toISOString()).toBe('2026-12-10T22:00:00.000Z');
  });

  it('uses the Kyiv calendar day, not the UTC one', () => {
    const lateEvening = new Date('2026-12-10T22:30:00Z');
    expect(startOfKyivDay(lateEvening).toISOString()).toBe(
      '2026-12-10T22:00:00.000Z',
    );
  });

  it('handles the day the clocks go back', () => {
    const at = new Date('2026-10-25T10:00:00Z');
    expect(startOfKyivDay(at).toISOString()).toBe('2026-10-24T21:00:00.000Z');
    expect(endOfKyivDay(at).toISOString()).toBe('2026-10-25T22:00:00.000Z');
  });
});

describe('date-only events (hasTime=false)', () => {
  const dayOnly = {
    ...base,
    hasTime: false,
    date: new Date('2026-12-09T22:00:00Z'),
  };

  it('stay upcoming until the end of their Kyiv day', () => {
    expect(isEventPast(dayOnly, new Date('2026-12-10T21:59:00Z'))).toBe(false);
    expect(isEventPast(dayOnly, new Date('2026-12-10T22:00:00Z'))).toBe(true);
  });

  it('close registration at the end of the day when no deadline is set', () => {
    expect(registrationDeadline(dayOnly).toISOString()).toBe(
      '2026-12-10T22:00:00.000Z',
    );
    expect(
      registrationClosedReason(dayOnly, 0, new Date('2026-12-10T20:00:00Z')),
    ).toBeNull();
  });
});

describe('registrationClosedReason', () => {
  const timed = { ...base, date: new Date('2026-12-10T16:00:00Z') };
  const before = new Date('2026-12-10T15:00:00Z');

  it('closes at the event start when no deadline is set', () => {
    expect(registrationClosedReason(timed, 0, before)).toBeNull();
    expect(
      registrationClosedReason(timed, 0, new Date('2026-12-10T16:00:00Z')),
    ).toBe('deadline');
  });

  it('respects an explicit deadline', () => {
    const event = {
      ...timed,
      registrationCloseDate: new Date('2026-12-09T12:00:00Z'),
    };
    expect(registrationClosedReason(event, 0, before)).toBe('deadline');
  });

  it('enforces capacity', () => {
    const event = { ...timed, maxRegistrations: 2 };
    expect(registrationClosedReason(event, 1, before)).toBeNull();
    expect(registrationClosedReason(event, 2, before)).toBe('capacity');
  });

  it('rejects drafts and events without registration', () => {
    expect(
      registrationClosedReason({ ...timed, isDraft: true }, 0, before),
    ).toBe('draft');
    expect(
      registrationClosedReason({ ...timed, noRegistration: true }, 0, before),
    ).toBe('noRegistration');
  });
});

describe('event list filters', () => {
  it('splits upcoming and past by Kyiv day for date-only events', () => {
    const now = new Date('2026-12-10T12:00:00Z');
    const dayStart = new Date('2026-12-09T22:00:00Z');
    expect(upcomingEventsWhere(now)).toEqual({
      OR: [
        { hasTime: true, date: { gte: now } },
        { hasTime: false, date: { gte: dayStart } },
      ],
    });
    expect(pastEventsWhere(now)).toEqual({
      OR: [
        { hasTime: true, date: { lt: now } },
        { hasTime: false, date: { lt: dayStart } },
      ],
    });
  });
});

describe('withRegistrationState', () => {
  it('exposes computed flags for the clients', () => {
    const event = {
      ...base,
      date: new Date('2026-12-10T16:00:00Z'),
      maxRegistrations: 1,
      _count: { registrations: 1 },
    };
    expect(
      withRegistrationState(event, new Date('2026-12-10T12:00:00Z')),
    ).toMatchObject({
      isPast: false,
      registrationOpen: false,
      registrationClosesAt: new Date('2026-12-10T16:00:00Z'),
    });
  });
});
