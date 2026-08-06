import { Module } from '@nestjs/common';
import { FundraiserController } from './fundraiser.controller';
import { FundraiserService } from './fundraiser.service';
import { MonobankService } from './monobank.service';
import { FundraiserScheduleService } from './fundraiser-schedule.service';

@Module({
  controllers: [FundraiserController],
  providers: [FundraiserService, MonobankService, FundraiserScheduleService],
})
export class FundraiserModule {}
