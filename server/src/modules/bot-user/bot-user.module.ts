import { Module } from '@nestjs/common';
import { BotUserController } from './bot-user.controller';
import { BotUserService } from './bot-user.service';

@Module({
  controllers: [BotUserController],
  providers: [BotUserService],
  exports: [BotUserService],
})
export class BotUserModule {}
