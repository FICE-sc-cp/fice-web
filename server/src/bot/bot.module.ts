import { Global, Module } from '@nestjs/common';
import { ProjectParticipantModule } from '../modules/project_participant/project_participant.module';
import { BotService } from './bot.service';

@Global()
@Module({
  imports: [ProjectParticipantModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
