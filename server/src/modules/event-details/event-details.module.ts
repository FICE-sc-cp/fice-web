import { Module } from '@nestjs/common';
import { EventDetailsService } from './event-details.service';
import { EventDetailsController } from './event-details.controller';

@Module({
  controllers: [EventDetailsController],
  providers: [EventDetailsService],
})
export class EventDetailsModule {}
