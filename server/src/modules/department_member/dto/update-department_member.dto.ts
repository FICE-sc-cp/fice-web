import { PartialType } from '@nestjs/swagger';
import { CreateDepartmentMemberDto } from './create-department_member.dto';

export class UpdateDepartmentMemberDto extends PartialType(CreateDepartmentMemberDto) {}
