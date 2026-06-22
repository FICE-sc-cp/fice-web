import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AddEventPartnerDto {
  @ApiProperty({ maxLength: 60, description: 'Partner name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;

  @ApiPropertyOptional({ description: 'Partner logo URL' })
  @IsOptional()
  @IsString()
  logoImage?: string;

  @ApiPropertyOptional({ description: 'Link to the partner site or social' })
  @IsOptional()
  @IsString()
  websiteLink?: string;
}
