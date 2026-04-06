import { Module } from '@nestjs/common';
import { DepartmentMemberService } from './department_member.service';
import { DepartmentMemberController } from './department_member.controller';

@Module({
  controllers: [DepartmentMemberController],
  providers: [DepartmentMemberService],
})
export class DepartmentMemberModule {}
