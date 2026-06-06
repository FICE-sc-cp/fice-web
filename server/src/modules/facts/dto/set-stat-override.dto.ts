import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class SetStatOverrideDto {
  @ApiProperty({ example: 5000, description: 'Pinned value for this stat' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  value: number;
}
