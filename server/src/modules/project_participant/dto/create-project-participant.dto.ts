import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProjectParticipantDto {
  @ApiProperty({ maxLength: 120, description: 'ПІБ учасника' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName: string;

  @ApiPropertyOptional({ maxLength: 50, description: 'Telegram-тег' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  telegramTag?: string;

  @ApiPropertyOptional({ description: 'URL/шлях до фото (аватарки)' })
  @IsOptional()
  @IsString()
  photo?: string;
}
