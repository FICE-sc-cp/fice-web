import { Module } from '@nestjs/common';
import { DepartmentDetailsService } from './department_details.service';
import { DepartmentDetailsController } from './department_details.controller';

@Module({
  controllers: [DepartmentDetailsController],
  providers: [DepartmentDetailsService],
})
export class DepartmentDetailsModule {}
