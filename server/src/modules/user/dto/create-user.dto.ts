import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    example: '@john_doe',
    maxLength: 50,
    description: 'Telegram username/tag of the admin user',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  telegramTag: string;
}
