export interface TelegramUser {
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Extract the Telegram user from a validated initData query string.
 *
 * We deliberately avoid `@tma.js/init-data-node`'s `parse()`: in v2.0.6 its
 * strict valibot schema throws on init-data that `validate()` accepts, which —
 * because `parse` ran outside the auth try/catch — turned every admin login
 * into an unhandled 500. The `user` field is a plain JSON string, so reading it
 * directly is both simpler and robust. Call only AFTER `validate()` has passed.
 */
export function extractTelegramUser(initData: string): TelegramUser | null {
  const raw = new URLSearchParams(initData).get('user');
  if (!raw) return null;
  try {
    const u = JSON.parse(raw) as Record<string, unknown>;
    if (typeof u.id !== 'number') return null;
    return {
      id: u.id,
      username: typeof u.username === 'string' ? u.username : undefined,
      firstName: typeof u.first_name === 'string' ? u.first_name : undefined,
      lastName: typeof u.last_name === 'string' ? u.last_name : undefined,
    };
  } catch {
    return null;
  }
}
