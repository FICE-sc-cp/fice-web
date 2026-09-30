import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { normalizeChatRef } from '../../../bot/department-chats';

export class CreateDepartmentDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({ description: 'Кількість учасників (для сторінки)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  memberCount?: number;

  @ApiPropertyOptional({
    maxLength: 64,
    description:
      'Telegram chat id, звідки бот збирає людей департаменту ("chatId" або "chatId/threadId" для гілки)',
  })
  @Transform(({ value }) => normalizeChatRef(value))
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^-\d+(\/\d+)?$/, {
    message:
      'telegramChatId Вкажи числовий ID групи, напр. -1001234567890, або -1001234567890/12 для однієї гілки',
  })
  telegramChatId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', description: 'Department head id' })
  @IsOptional()
  @IsUUID()
  headId?: string;
}
