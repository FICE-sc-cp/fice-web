import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NewsCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateNewsDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  title: string;

  @ApiPropertyOptional({ description: 'Full article body' })
  @IsOptional()
  @IsString()
  details?: string;

  @ApiPropertyOptional({ description: 'Cover image URL' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Publish date; defaults to now',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  publishDate?: Date;

  @ApiPropertyOptional({ enum: NewsCategory })
  @IsOptional()
  @IsEnum(NewsCategory)
  category?: NewsCategory | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Date and time of the announced event',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  eventDate?: Date | null;

  @ApiPropertyOptional({ maxLength: 100, description: 'Event location' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  eventLocation?: string | null;
}
