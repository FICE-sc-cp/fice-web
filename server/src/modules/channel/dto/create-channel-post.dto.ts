import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateChannelPostDto {
  @ApiProperty({ maxLength: 4096, description: 'Текст поста' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  text: string;

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
