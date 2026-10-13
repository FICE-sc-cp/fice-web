import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class ApplicantQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Name, @tag, group or phone' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Applied to at least one of these departments (comma-separated)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : value,
  )
  @IsUUID('all', { each: true })
  departmentIds?: string[];

  @ApiPropertyOptional({
    example: '2026-09-01',
    description: 'Submitted on or after (Kyiv date)',
  })
  @IsOptional()
  @Matches(DAY)
  from?: string;

  @ApiPropertyOptional({
    example: '2026-09-30',
    description: 'Submitted on or before (Kyiv date)',
  })
  @IsOptional()
  @Matches(DAY)
  to?: string;
}
