import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { TelegramAuthGuard } from './telegram-auth.guard';

export function Admin() {
  return applyDecorators(
    UseGuards(TelegramAuthGuard),
    ApiSecurity('telegram'),
    ApiUnauthorizedResponse({
      description: 'Missing or invalid Telegram init data',
    }),
  );
}
