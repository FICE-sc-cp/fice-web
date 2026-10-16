import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class PublisherDto {
  @ApiProperty({ example: '@username' })
  @IsString()
  @MaxLength(60)
  telegramTag: string;
}
