import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validate } from '@tma.js/init-data-node';

export interface TelegramUser {
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
}

export interface ResolvedTelegramUser {
  telegramId: bigint;
  username?: string;
  firstName?: string;
  lastName?: string;
  staffName: string;
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

/**
 * Validates and extracts a Telegram user from `x-telegram-init-data`.
 * Uses USER_BOT_TOKEN or TELEGRAM_BOT_TOKEN from ConfigService.
 * If AUTH_DISABLED is true, allows fallback parameters for local development.
 */
export function resolveValidatedTelegramUser(
  config: ConfigService,
  initData?: string,
  fallback?: { id?: string; tag?: string },
): ResolvedTelegramUser {
  const authDisabled = config.get<string>('AUTH_DISABLED') === 'true';

  if (!initData) {
    if (authDisabled && (fallback?.id || fallback?.tag)) {
      const id = fallback.id ? BigInt(fallback.id) : BigInt(0);
      const tag =
        fallback.tag || (fallback.id ? `dev_${fallback.id}` : 'dev_user');
      return {
        telegramId: id,
        username: tag,
        firstName: tag,
        staffName: tag,
      };
    }
    throw new UnauthorizedException('Відсутні дані авторизації Telegram');
  }

  const userToken = config.get<string>('USER_BOT_TOKEN');
  const adminToken = config.get<string>('TELEGRAM_BOT_TOKEN');

  if (userToken || adminToken) {
    let isValid = false;
    if (userToken) {
      try {
        validate(initData, userToken);
        isValid = true;
      } catch {}
    }
    if (!isValid && adminToken) {
      try {
        validate(initData, adminToken);
        isValid = true;
      } catch {}
    }
    if (!isValid && !authDisabled) {
      throw new UnauthorizedException('Невалідні дані Telegram init data');
    }
  } else if (!authDisabled) {
    throw new UnauthorizedException(
      'Telegram bot token не налаштовано на сервері',
    );
  }

  const user = extractTelegramUser(initData);
  if (!user) {
    if (authDisabled && fallback?.id) {
      return {
        telegramId: BigInt(fallback.id),
        username: fallback.tag,
        staffName: fallback.tag || fallback.id,
      };
    }
    throw new UnauthorizedException(
      'Telegram init data не містить валідного користувача',
    );
  }

  const staffName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    user.username ||
    String(user.id);

  return {
    telegramId: BigInt(user.id),
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    staffName,
  };
}
