import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreatePartnerDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Logo image URL or path' })
  @IsOptional()
  @IsString()
  logoImage?: string;

  @ApiPropertyOptional({ description: 'Partner website' })
  @IsOptional()
  @IsUrl()
  websiteLink?: string;
}
