import { Module } from '@nestjs/common';
import { ApplicantController } from './applicant.controller';
import { ApplicantService } from './applicant.service';
import { GoogleSheetsService } from './google-sheets.service';

@Module({
  controllers: [ApplicantController],
  providers: [ApplicantService, GoogleSheetsService],
  exports: [ApplicantService, GoogleSheetsService],
})
export class ApplicantModule {}
