import { Module } from '@nestjs/common';
import { DepartmentDetailsController } from './department_details.controller';
import { DepartmentDetailsService } from './department_details.service';

@Module({
  controllers: [DepartmentDetailsController],
  providers: [DepartmentDetailsService],
})
export class DepartmentDetailsModule {}
