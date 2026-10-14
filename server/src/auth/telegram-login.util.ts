import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ResolvedTelegramUser } from './init-data.util';

/** A Login Widget sign-in stays valid this long; then the page asks to sign in again. */
export const TELEGRAM_LOGIN_MAX_AGE_S = 7 * 24 * 3600;

/**
 * Checks Telegram Login Widget data (the widget's user object as a query
 * string) against the bot token: https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyTelegramLogin(
  raw: string,
  botToken: string,
  now = Date.now(),
): ResolvedTelegramUser | null {
  const params = new URLSearchParams(raw);
  const hash = params.get('hash') ?? '';
  params.delete('hash');
  const check = [...params]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHash('sha256').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(check).digest('hex');
  if (
    hash.length !== expected.length ||
    !timingSafeEqual(Buffer.from(hash), Buffer.from(expected))
  ) {
    return null;
  }

  const authDate = Number(params.get('auth_date'));
  const id = params.get('id') ?? '';
  if (!authDate || now / 1000 - authDate > TELEGRAM_LOGIN_MAX_AGE_S)
    return null;
  if (!/^\d+$/.test(id)) return null;

  const username = params.get('username') || undefined;
  const firstName = params.get('first_name') || undefined;
  const lastName = params.get('last_name') || undefined;
  return {
    telegramId: BigInt(id),
    username,
    firstName,
    lastName,
    staffName:
      [firstName, lastName].filter(Boolean).join(' ') || username || id,
  };
}

/**
 * The signed-in user from the `x-telegram-login` header, checked against the
 * user bot (the bot the widget is set up for). With AUTH_DISABLED a page opened
 * with `?tgUserId=&tgTag=` signs in as that user, like the mini-apps do.
 */
export function resolveTelegramLogin(
  config: ConfigService,
  raw?: string,
  fallback?: { id?: string; tag?: string },
): ResolvedTelegramUser {
  if (!raw && config.get<string>('AUTH_DISABLED') === 'true' && fallback?.id) {
    const tag = fallback.tag || `dev_${fallback.id}`;
    return {
      telegramId: BigInt(fallback.id),
      username: tag,
      staffName: tag,
    };
  }
  const token = config.get<string>('USER_BOT_TOKEN');
  if (!token) {
    throw new UnauthorizedException(
      'Вхід через Telegram не налаштовано на сервері',
    );
  }
  const user = raw ? verifyTelegramLogin(raw, token) : null;
  if (!user) {
    throw new UnauthorizedException('Увійди через Telegram ще раз');
  }
  return user;
}
