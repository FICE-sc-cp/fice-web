import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateEventDetailsDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;

  @ApiProperty({ example: 0, description: 'Money collected at the event' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  moneyCollected: number;

  @ApiProperty({ example: 0, description: 'Amount donated to charity' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  charityAmount: number;

  @ApiPropertyOptional({ example: 100, description: 'Number of visitors' })
  @IsOptional()
  @IsInt()
  @Min(0)
  visitorsAmount?: number;

  @ApiPropertyOptional({ format: 'uuid', description: 'Owning department id' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
