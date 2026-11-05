import { Module } from '@nestjs/common';
import { GoogleSheetsService } from '../applicant/google-sheets.service';
import { MerchAdminController } from './merch-admin.controller';
import { MerchAdminGuard } from './merch-admin.guard';
import { MerchAdminService } from './merch-admin.service';
import { MerchCatalogService } from './merch-catalog.service';
import { MerchChatService } from './merch-chat.service';
import { MerchOrderService } from './merch-order.service';
import { MerchSheetService } from './merch-sheet.service';
import { MerchSyncService } from './merch-sync.service';
import { MerchController } from './merch.controller';

@Module({
  controllers: [MerchController, MerchAdminController],
  providers: [
    MerchCatalogService,
    MerchOrderService,
    MerchAdminService,
    MerchChatService,
    MerchSyncService,
    MerchSheetService,
    GoogleSheetsService,
    MerchAdminGuard,
  ],
})
export class MerchModule {}
