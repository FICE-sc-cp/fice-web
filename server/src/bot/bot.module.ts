import { Global, Module } from '@nestjs/common';
import { ProjectParticipantModule } from '../modules/project_participant/project_participant.module';
import { BotService } from './bot.service';
import { InterviewBotService } from './interview-bot.service';
import { UserBotService } from './user-bot.service';

@Global()
@Module({
  imports: [ProjectParticipantModule],
  providers: [BotService, UserBotService, InterviewBotService],
  exports: [BotService, UserBotService, InterviewBotService],
})
export class BotModule {}
