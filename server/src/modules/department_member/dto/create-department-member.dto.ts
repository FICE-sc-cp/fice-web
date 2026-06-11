import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DepartmentMemberRole } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

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

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Напрям/спеціалізація (напр. для заступників)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialization?: string;
}
