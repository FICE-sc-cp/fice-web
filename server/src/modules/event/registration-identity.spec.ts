import {
  confirmingAccountMatches,
  normalizeTelegramUsername,
  telegramTagOf,
} from './registration-identity';

describe('normalizeTelegramUsername', () => {
  it('strips @ and lowercases valid usernames', () => {
    expect(normalizeTelegramUsername('@Denys_H')).toBe('denys_h');
    expect(normalizeTelegramUsername('  @@fice_student_bot ')).toBe(
      'fice_student_bot',
    );
    expect(normalizeTelegramUsername('abcd')).toBe('abcd');
  });

  it.each([
    '%',
    '_____',
    '%denys%',
    'den%ys',
    'den ys',
    '1denys',
    'denys_',
    'abc',
    'a'.repeat(33),
    '',
    null,
    undefined,
  ])('rejects %p', (raw) => {
    expect(normalizeTelegramUsername(raw)).toBeNull();
  });

  it('builds the stored @tag', () => {
    expect(telegramTagOf('denys')).toBe('@denys');
  });
});

describe('confirmingAccountMatches', () => {
  it('accepts the account whose username is the typed tag, ignoring case', () => {
    expect(confirmingAccountMatches('@denys', 'Denys')).toBe(true);
  });

  it('rejects a different account', () => {
    expect(confirmingAccountMatches('@victim', 'attacker')).toBe(false);
  });

  it('rejects an account without a username', () => {
    expect(confirmingAccountMatches('@victim', undefined)).toBe(false);
    expect(confirmingAccountMatches('@victim', '')).toBe(false);
  });

  it('never treats wildcard characters as a match', () => {
    expect(confirmingAccountMatches('@_____', 'denys')).toBe(false);
    expect(confirmingAccountMatches('@%', 'denys')).toBe(false);
  });
});
