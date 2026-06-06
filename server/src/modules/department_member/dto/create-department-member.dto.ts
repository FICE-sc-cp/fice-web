import { ApiProperty } from '@nestjs/swagger';
import { DepartmentMemberRole } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateDepartmentMemberDto {
  @ApiProperty({ enum: DepartmentMemberRole })
  @IsEnum(DepartmentMemberRole)
  role: DepartmentMemberRole;

  @ApiProperty({ maxLength: 30 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  firstName: string;

  @ApiProperty({ maxLength: 30 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  lastName: string;
}
