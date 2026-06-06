import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  shortDescription: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Department head id' })
  @IsOptional()
  @IsUUID()
  headId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Department details id' })
  @IsOptional()
  @IsUUID()
  detailsId?: string;
}
