import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { TelegramAuthGuard } from './telegram-auth.guard';

/**
 * Marks an endpoint as admin-only: it requires a valid Telegram Mini App
 * `initData` signature (see {@link TelegramAuthGuard}) and documents the
 * security requirement in Swagger.
 */
export function Admin() {
  return applyDecorators(
    UseGuards(TelegramAuthGuard),
    ApiSecurity('telegram'),
    ApiUnauthorizedResponse({
      description: 'Missing or invalid Telegram init data',
    }),
  );
}
