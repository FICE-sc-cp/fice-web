import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { TelegramAuthGuard } from './telegram-auth.guard';

@Global()
@Module({
  controllers: [AuthController],
  providers: [TelegramAuthGuard],
  exports: [TelegramAuthGuard],
})
export class AuthModule {}
