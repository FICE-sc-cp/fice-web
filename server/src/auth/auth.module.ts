import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AdminAccessService } from './admin-access.service';
import { TelegramAuthGuard } from './telegram-auth.guard';

@Global()
@Module({
  controllers: [AuthController],
  providers: [TelegramAuthGuard, AdminAccessService],
  exports: [TelegramAuthGuard, AdminAccessService],
})
export class AuthModule {}
