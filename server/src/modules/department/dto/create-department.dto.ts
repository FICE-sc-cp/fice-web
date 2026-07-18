import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({ description: 'Кількість учасників (для сторінки)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  memberCount?: number;

  @ApiPropertyOptional({ format: 'uuid', description: 'Department head id' })
  @IsOptional()
  @IsUUID()
  headId?: string;
}
