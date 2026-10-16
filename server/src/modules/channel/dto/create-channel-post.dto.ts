import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateChannelPostDto {
  // HTML: Telegram's own 4096 / 1024 limits count the text without tags and
  // are checked by the service.
  @ApiProperty({ maxLength: 16000, description: 'Текст поста (HTML)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(16000)
  text: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Коли опублікувати; порожньо або минулий час — одразу',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  publishAt?: Date;

  @ApiPropertyOptional({
    description: 'Зображення (шлях /uploads/... або зовнішній URL)',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Захід — кнопка веде на його сторінку реєстрації',
  })
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @ApiPropertyOptional({ maxLength: 64, description: 'Підпис кнопки' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  buttonText?: string;

  @ApiPropertyOptional({
    description: 'Довільне посилання для кнопки (замість заходу)',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  buttonUrl?: string;
}
