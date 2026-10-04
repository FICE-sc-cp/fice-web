import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AdminAccessService } from './admin-access.service';
import { DownloadTokenService } from './download-token.service';
import { TelegramAuthGuard } from './telegram-auth.guard';

@Global()
@Module({
  controllers: [AuthController],
  providers: [TelegramAuthGuard, AdminAccessService, DownloadTokenService],
  exports: [TelegramAuthGuard, AdminAccessService, DownloadTokenService],
})
export class AuthModule {}
