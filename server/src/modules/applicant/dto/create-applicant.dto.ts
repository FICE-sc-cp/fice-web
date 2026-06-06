import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ApplicantDepartmentSelectionDto {
  @ApiProperty({ format: 'uuid', description: 'Department applied to' })
  @IsUUID()
  departmentId: string;

  @ApiPropertyOptional({
    description: 'Optional answer/question for this department',
  })
  @IsOptional()
  @IsString()
  question?: string;
}

export class CreateApplicantDto {
  @ApiProperty({ maxLength: 30 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  firstName: string;

  @ApiProperty({ maxLength: 30 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  middleName: string;

  @ApiProperty({ maxLength: 30 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  lastName: string;

  @ApiProperty({ maxLength: 50, example: '@applicant' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  telegramTag: string;

  @ApiProperty({ maxLength: 5, example: 'ІП-21' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5)
  group: string;

  @ApiProperty({ maxLength: 20, example: '+380991234567' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phoneNumber: string;

  @ApiPropertyOptional({ description: 'Why they want to join' })
  @IsOptional()
  @IsString()
  motivation?: string;

  @ApiPropertyOptional({ description: 'Relevant experience' })
  @IsOptional()
  @IsString()
  experience?: string;

  @ApiProperty({
    type: [ApplicantDepartmentSelectionDto],
    description: 'Departments the person applies to (at least one)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ApplicantDepartmentSelectionDto)
  departments: ApplicantDepartmentSelectionDto[];
}
