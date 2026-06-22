import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FundraiserStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
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

  @ApiProperty({ example: 480000, description: 'Target amount' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  goalAmount: number;

  @ApiPropertyOptional({
    example: 0,
    default: 0,
    description: 'Amount collected so far',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  currentAmount?: number;

  @ApiPropertyOptional({ example: 0, default: 0, description: 'Number of donations' })
  @IsOptional()
  @IsInt()
  @Min(0)
  donationsCount?: number;

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
    maxLength: 40,
    description: 'Monobank jar account id, enables automatic balance sync',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  monoJarId?: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  endDate: Date;

  @ApiPropertyOptional({ description: 'External link with more details' })
  @IsOptional()
  @IsUrl()
  detailsLink?: string;
}
