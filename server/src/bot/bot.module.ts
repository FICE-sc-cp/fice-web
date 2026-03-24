import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { TelegramAuthGuard } from './guards/telegram-auth.guard';
import { APP_GUARD } from '@nestjs/core';

@Module({
  providers: [
    BotService,
    // Temporary disabled for development
    // {
    //   provide: APP_GUARD,
    //   useClass: TelegramAuthGuard,
    // },
  ],
  exports: [BotService],
})
export class BotModule {}
