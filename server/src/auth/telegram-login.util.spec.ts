import { createHash, createHmac } from 'crypto';
import {
  TELEGRAM_LOGIN_MAX_AGE_S,
  verifyTelegramLogin,
} from './telegram-login.util';

const TOKEN = '123456:test-token';
const NOW = 1_800_000_000_000;

function signed(fields: Record<string, string>, token = TOKEN): string {
  const check = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');
  const secret = createHash('sha256').update(token).digest();
  const hash = createHmac('sha256', secret).update(check).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

const user = {
  id: '42',
  first_name: 'Олена',
  username: 'olena_k',
  photo_url: 'https://t.me/i/userpic/320/x.jpg',
  auth_date: String(NOW / 1000 - 60),
};

describe('verifyTelegramLogin', () => {
  it('accepts data signed by the bot', () => {
    expect(verifyTelegramLogin(signed(user), TOKEN, NOW)).toEqual({
      telegramId: 42n,
      username: 'olena_k',
      firstName: 'Олена',
      lastName: undefined,
      staffName: 'Олена',
    });
  });

  it('rejects tampered fields, other bots and missing hashes', () => {
    const tampered = signed(user).replace('olena_k', 'admin_k');
    expect(verifyTelegramLogin(tampered, TOKEN, NOW)).toBeNull();
    expect(verifyTelegramLogin(signed(user, '1:other'), TOKEN, NOW)).toBeNull();
    expect(
      verifyTelegramLogin(new URLSearchParams(user).toString(), TOKEN, NOW),
    ).toBeNull();
  });

  it('rejects stale sign-ins', () => {
    const old = {
      ...user,
      auth_date: String(NOW / 1000 - TELEGRAM_LOGIN_MAX_AGE_S - 1),
    };
    expect(verifyTelegramLogin(signed(old), TOKEN, NOW)).toBeNull();
  });
});
