const TELEGRAM_USERNAME = /^[a-z][a-z0-9_]{2,30}[a-z0-9]$/;

export function normalizeTelegramUsername(
  raw: string | null | undefined,
): string | null {
  const clean = (raw ?? '').trim().replace(/^@+/, '').toLowerCase();
  return TELEGRAM_USERNAME.test(clean) ? clean : null;
}

export function telegramTagOf(username: string): string {
  return `@${username}`;
}

export function confirmingAccountMatches(
  pendingTag: string,
  confirmingUsername: string | null | undefined,
): boolean {
  const expected = normalizeTelegramUsername(pendingTag);
  const actual = normalizeTelegramUsername(confirmingUsername);
  return expected !== null && expected === actual;
}
