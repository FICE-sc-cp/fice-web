import { Module } from '@nestjs/common';
import { DepartmentHeadController } from './department_head.controller';
import { DepartmentHeadService } from './department_head.service';

@Module({
  controllers: [DepartmentHeadController],
  providers: [DepartmentHeadService],
})
export class DepartmentHeadModule {}
