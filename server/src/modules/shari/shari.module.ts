import { Module } from '@nestjs/common';
import { GoogleSheetsService } from '../applicant/google-sheets.service';
import { ShariSheetService } from './shari-sheet.service';
import { ShariController } from './shari.controller';
import { ShariService } from './shari.service';

@Module({
  controllers: [ShariController],
  providers: [ShariService, ShariSheetService, GoogleSheetsService],
})
export class ShariModule {}
