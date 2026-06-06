import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AddEventPartnerDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Partner to attach to the event',
  })
  @IsUUID()
  partnerId: string;
}
