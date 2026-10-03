import { Module } from '@nestjs/common';
import { PublicUploadQuotaInterceptor } from './public-upload-quota.interceptor';
import { PublicUploadService } from './public-upload.service';
import { UploadController } from './upload.controller';

@Module({
  controllers: [UploadController],
  providers: [PublicUploadService, PublicUploadQuotaInterceptor],
})
export class UploadModule {}
