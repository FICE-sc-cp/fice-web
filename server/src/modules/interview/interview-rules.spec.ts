import {
  bookingProblem,
  splitWindow,
  staffRoles,
  tagUsername,
} from './interview-rules';

const at = (iso: string) => new Date(iso);
const span = (start: string, end: string) => ({
  startsAt: at(start),
  endsAt: at(end),
});

describe('splitWindow', () => {
  it('cuts a Kyiv-time window into whole slots (summer time, UTC+3)', () => {
    const slots = splitWindow('2026-10-20', '14:00', '15:10', 30);
    expect(slots).toEqual([
      span('2026-10-20T11:00:00Z', '2026-10-20T11:30:00Z'),
      span('2026-10-20T11:30:00Z', '2026-10-20T12:00:00Z'),
    ]);
  });

  it('uses winter time after the clocks change (UTC+2)', () => {
    expect(splitWindow('2026-11-02', '10:00', '10:20', 20)).toEqual([
      span('2026-11-02T08:00:00Z', '2026-11-02T08:20:00Z'),
    ]);
  });

  it('returns nothing for an empty or reversed window', () => {
    expect(splitWindow('2026-10-20', '14:00', '14:10', 30)).toEqual([]);
    expect(splitWindow('2026-10-20', '16:00', '14:00', 30)).toEqual([]);
  });
});

describe('tagUsername', () => {
  it('normalizes tags the way admins type them', () => {
    expect(tagUsername('@Taras_Sheva')).toBe('taras_sheva');
    expect(tagUsername(' https://t.me/taras_sheva ')).toBe('taras_sheva');
    expect(tagUsername('t.me/taras_sheva')).toBe('taras_sheva');
    expect(tagUsername('not a tag')).toBeNull();
    expect(tagUsername(null)).toBeNull();
  });
});

describe('staffRoles', () => {
  const departments = [
    { id: 'media', head: { telegramTag: '@Media_Head' } },
    { id: 'merch', head: null },
    { id: 'projects', head: { telegramTag: 'someone_else' } },
  ];

  it('makes the tagged head manage only their department', () => {
    const roles = staffRoles('media_head', departments, ['merch'], false);
    expect([...roles]).toEqual([
      ['media', 'HEAD'],
      ['merch', 'RECRUITER'],
    ]);
  });

  it('gives presidium members every remaining department', () => {
    const roles = staffRoles('media_head', departments, [], true);
    expect(roles.get('media')).toBe('HEAD');
    expect(roles.get('merch')).toBe('ADMIN');
    expect(roles.get('projects')).toBe('ADMIN');
  });

  it('gives a user without a username or roles nothing', () => {
    expect(staffRoles(null, departments, [], false).size).toBe(0);
  });
});

describe('bookingProblem', () => {
  const now = at('2026-10-20T08:00:00Z');
  const later = span('2026-10-20T12:00:00Z', '2026-10-20T12:30:00Z');

  it('allows a free slot well ahead', () => {
    expect(bookingProblem(now, later, null, [])).toBeNull();
  });

  it('refuses slots starting within an hour', () => {
    const soon = span('2026-10-20T08:45:00Z', '2026-10-20T09:15:00Z');
    expect(bookingProblem(now, soon, null, [])).toMatch(/за годину/);
  });

  it('refuses to move an interview that starts within an hour', () => {
    const current = span('2026-10-20T08:30:00Z', '2026-10-20T09:00:00Z');
    expect(bookingProblem(now, later, current, [])).toMatch(/Змінити час/);
  });

  it('refuses a time that clashes with the other department interview', () => {
    const other = span('2026-10-20T12:15:00Z', '2026-10-20T12:45:00Z');
    expect(bookingProblem(now, later, null, [other])).toMatch(/інша/);
  });
});
