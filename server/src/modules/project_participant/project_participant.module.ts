import { Module } from '@nestjs/common';
import { ProjectParticipantController } from './project_participant.controller';
import { ProjectParticipantService } from './project_participant.service';

@Module({
  controllers: [ProjectParticipantController],
  providers: [ProjectParticipantService],
  exports: [ProjectParticipantService],
})
export class ProjectParticipantModule {}
