import { Module } from '@nestjs/common';
import { ShariController } from './shari.controller';
import { ShariService } from './shari.service';

@Module({
  controllers: [ShariController],
  providers: [ShariService],
})
export class ShariModule {}
