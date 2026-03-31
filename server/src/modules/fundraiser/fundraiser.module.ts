import { Module } from '@nestjs/common';
import { FundraiserService } from './fundraiser.service';
import { FundraiserController } from './fundraiser.controller';

@Module({
  controllers: [FundraiserController],
  providers: [FundraiserService],
})
export class FundraiserModule {}
