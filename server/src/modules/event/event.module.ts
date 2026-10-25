import { Module } from '@nestjs/common';
import { GoogleSheetsService } from '../applicant/google-sheets.service';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { RegistrationSheetsService } from './registration-sheets.service';

@Module({
  controllers: [EventController],
  providers: [EventService, RegistrationSheetsService, GoogleSheetsService],
})
export class EventModule {}
