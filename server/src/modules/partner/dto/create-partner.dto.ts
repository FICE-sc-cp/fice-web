import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreatePartnerDto {
  @ApiProperty({ maxLength: 30 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  name: string;

  @ApiPropertyOptional({ description: 'Logo image URL or path' })
  @IsOptional()
  @IsString()
  logoImage?: string;

  @ApiPropertyOptional({ description: 'Partner website' })
  @IsOptional()
  @IsUrl()
  websiteLink?: string;

  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  shortDescription?: string;
}
