import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDepartmentDetailsDto {
  @ApiProperty({ description: 'Short "about" text for the department' })
  @IsString()
  @IsNotEmpty()
  about: string;

  @ApiPropertyOptional({ description: 'Longer description' })
  @IsOptional()
  @IsString()
  detailedDescription?: string;

  @ApiPropertyOptional({ description: 'Example of the department work' })
  @IsOptional()
  @IsString()
  exampleOfWork?: string;
}
