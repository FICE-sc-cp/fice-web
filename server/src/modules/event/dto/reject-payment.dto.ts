import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RejectPaymentDto {
  @ApiPropertyOptional({ description: 'Reason for payment rejection' })
  @IsOptional()
  @IsString()
  reason?: string;
}
