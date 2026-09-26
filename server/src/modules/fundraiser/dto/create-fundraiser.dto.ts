import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FundraiserStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFundraiserDto {
  @ApiProperty({ maxLength: 120, example: 'Пікап для евакуаційної групи 47-ї бригади' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({
    enum: FundraiserStatus,
    default: FundraiserStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(FundraiserStatus)
  status?: FundraiserStatus;

  @ApiProperty({ maxLength: 255, description: 'Short lead shown under the title' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;

  @ApiPropertyOptional({ description: 'Full "About the fundraiser" body' })
  @IsOptional()
  @IsString()
  story?: string;

  @ApiPropertyOptional({ description: 'Hero image URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ maxLength: 100, example: 'Запорізький напрямок' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({
    example: 480000,
    default: 0,
    description: 'Target amount; replaced by the jar goal when a linked jar has one',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  goalAmount?: number;

  @ApiPropertyOptional({
    example: 0,
    default: 0,
    description: 'Amount collected so far; ignored when a jar widget is linked',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  currentAmount?: number;

  @ApiPropertyOptional({ maxLength: 25, example: '5375 4141 0000 1234' })
  @IsOptional()
  @IsString()
  @MaxLength(25)
  cardNumber?: string;

  @ApiPropertyOptional({ description: 'Monobank jar link', example: 'https://send.monobank.ua/jar/…' })
  @IsOptional()
  @IsUrl()
  jarUrl?: string;

  @ApiPropertyOptional({
    maxLength: 500,
    nullable: true,
    description:
      'Monobank jar widget link (contains jar=...). Enables automatic sync of the raised amount, goal and jar link; empty or null unlinks',
    example:
      'https://send.monobank.ua/widget.html?jar=3nzmmsWPvF88kT6FKrnpUwSaLkF2pwMK&sendId=6MJtUJ8B8d&type=qrp',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  jarWidgetUrl?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'Start date. Defaults to today (Kyiv) on create when omitted; null means no dates',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'End date; requires a start date and must not be before it',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date | null;

  @ApiPropertyOptional({ description: 'External link with more details' })
  @IsOptional()
  @IsUrl()
  detailsLink?: string;
}
