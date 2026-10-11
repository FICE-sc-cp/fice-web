import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetApplicationStatusDto {
  @ApiProperty({
    example: false,
    description: 'true — заявки приймаються, false — подачу закрито',
  })
  @IsBoolean()
  open: boolean;
}
