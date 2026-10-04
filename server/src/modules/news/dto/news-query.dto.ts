import { ApiPropertyOptional } from '@nestjs/swagger';
import { NewsCategory } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

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
