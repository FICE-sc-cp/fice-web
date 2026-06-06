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
  @ApiProperty({ maxLength: 30, example: 'Help the shelter' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  name: string;

  @ApiPropertyOptional({
    enum: FundraiserStatus,
    default: FundraiserStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(FundraiserStatus)
  status?: FundraiserStatus;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;

  @ApiProperty({ example: 10000, description: 'Target amount' })
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
