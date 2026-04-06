import { Module } from '@nestjs/common';
import { DepartmentHeadService } from './department_head.service';
import { DepartmentHeadController } from './department_head.controller';

@Module({
  controllers: [DepartmentHeadController],
  providers: [DepartmentHeadService],
})
export class DepartmentHeadModule {}
