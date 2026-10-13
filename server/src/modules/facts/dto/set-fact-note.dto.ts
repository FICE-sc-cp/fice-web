import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class SetFactNoteDto {
  @ApiProperty({
    example: 'з вересня 2023',
    description: 'Line under the number on the site; empty removes it',
  })
  @IsString()
  @MaxLength(120)
  note: string;
}
