import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBlockedUserDto {
  @ApiProperty({ example: '@student_tag', description: 'Telegram username with or without @' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  telegramTag: string;

  @ApiPropertyOptional({ example: 'ФСП-21' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  group?: string;

  @ApiPropertyOptional({ example: 'ФСП' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  faculty?: string;

  @ApiPropertyOptional({ example: 'Спроба реєстрації з недозволеної групи' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;
}
