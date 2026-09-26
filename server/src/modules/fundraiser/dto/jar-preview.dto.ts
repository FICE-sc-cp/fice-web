import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class JarPreviewDto {
  @ApiProperty({
    maxLength: 500,
    example:
      'https://send.monobank.ua/widget.html?jar=3nzmmsWPvF88kT6FKrnpUwSaLkF2pwMK&sendId=6MJtUJ8B8d&type=qrp',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  jarWidgetUrl: string;
}
