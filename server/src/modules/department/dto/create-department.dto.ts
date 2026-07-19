import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

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
  @IsOptional()
  @IsString()
  @MaxLength(64)
  telegramChatId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Department head id' })
  @IsOptional()
  @IsUUID()
  headId?: string;
}
