import { Module } from '@nestjs/common';
import { DepartmentMemberController } from './department_member.controller';
import { DepartmentMemberService } from './department_member.service';

@Module({
  controllers: [DepartmentMemberController],
  providers: [DepartmentMemberService],
})
export class DepartmentMemberModule {}
