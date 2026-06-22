import { Module } from '@nestjs/common';
import { FundraiserController } from './fundraiser.controller';
import { FundraiserService } from './fundraiser.service';
import { MonobankService } from './monobank.service';

@Module({
  controllers: [FundraiserController],
  providers: [FundraiserService, MonobankService],
})
export class FundraiserModule {}
