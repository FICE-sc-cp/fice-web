import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { TelegramAuthGuard } from './telegram-auth.guard';

/**
 * Global module exposing the {@link TelegramAuthGuard} so any controller can use
 * the `@Admin()` decorator without importing the guard locally. Admin
 * authorization relies on the (global) BotService to check Telegram group
 * membership.
 */
@Global()
@Module({
  controllers: [AuthController],
  providers: [TelegramAuthGuard],
  exports: [TelegramAuthGuard],
})
export class AuthModule {}
