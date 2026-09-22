import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBroadcastDto {
  @ApiProperty({ description: 'HTML-formatted text of the broadcast' })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiPropertyOptional({ description: 'Photo URL or uploaded receipt/image URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ maxLength: 60, example: 'Відкрити реєстрацію' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  buttonText?: string;

  @ApiPropertyOptional({ example: 'https://t.me/...' })
  @IsOptional()
  @IsString()
  buttonUrl?: string;
}
