import { Module } from '@nestjs/common';
import { BroadcastModule } from '../broadcast/broadcast.module';
import { VotingController } from './voting.controller';
import { VotingService } from './voting.service';

@Module({
  imports: [BroadcastModule],
  controllers: [VotingController],
  providers: [VotingService],
  exports: [VotingService],
})
export class VotingModule {}
