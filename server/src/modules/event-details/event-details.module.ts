import { Module } from '@nestjs/common';
import { EventDetailsController } from './event-details.controller';
import { EventDetailsService } from './event-details.service';

@Module({
  controllers: [EventDetailsController],
  providers: [EventDetailsService],
})
export class EventDetailsModule {}
