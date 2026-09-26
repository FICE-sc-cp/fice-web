import { Module } from '@nestjs/common';
import { FundraiserController } from './fundraiser.controller';
import { FundraiserService } from './fundraiser.service';
import { FundraiserScheduleService } from './fundraiser-schedule.service';
import { MonobankJarClient } from './monobank-jar.client';
import { JarSyncService } from './jar-sync.service';

@Module({
  controllers: [FundraiserController],
  providers: [
    FundraiserService,
    FundraiserScheduleService,
    MonobankJarClient,
    JarSyncService,
  ],
})
export class FundraiserModule {}
