import { ApiPropertyOptional } from '@nestjs/swagger';
import { NewsCategory } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class NewsStatsQueryDto {
  @ApiPropertyOptional({
    example: '2026-09-01',
    description: 'Kyiv date, inclusive',
  })
  @IsOptional()
  @Matches(DAY)
  from?: string;

  @ApiPropertyOptional({
    example: '2026-09-30',
    description: 'Kyiv date, inclusive',
  })
  @IsOptional()
  @Matches(DAY)
  to?: string;
}

export class NewsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Full-text search over title and details',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: NewsCategory })
  @IsOptional()
  @IsEnum(NewsCategory)
  category?: NewsCategory;

  @ApiPropertyOptional({ description: 'true — include drafts (admin only)' })
  @IsOptional()
  @Transform(({ value }): boolean | undefined => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  draft?: boolean;
}
