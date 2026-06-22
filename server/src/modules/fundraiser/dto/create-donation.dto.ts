import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateDonationDto {
  @ApiPropertyOptional({ maxLength: 60, description: 'Donor name, empty = anonymous' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @ApiProperty({ example: 500, description: 'Donation amount in UAH' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  comment?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  createdAt?: Date;
}
