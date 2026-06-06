import { PartialType } from '@nestjs/swagger';
import { CreateDepartmentMemberDto } from './create-department-member.dto';

export class UpdateDepartmentMemberDto extends PartialType(
  CreateDepartmentMemberDto,
) {}
