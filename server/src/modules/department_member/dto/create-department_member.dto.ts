import { IsString, IsNotEmpty, MaxLength, IsEnum } from 'class-validator';
import { DepartmentMemberRole } from '../enums/department-member-role.enum';

export class CreateDepartmentMemberDto {
  @IsEnum(DepartmentMemberRole)
  @IsNotEmpty()
  role: DepartmentMemberRole;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  lastName: string;
}
