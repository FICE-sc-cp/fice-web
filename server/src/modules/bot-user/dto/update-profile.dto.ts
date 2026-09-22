import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional({ maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  group?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  birthDate?: Date;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;
}
