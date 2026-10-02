import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ScanCheckInDto {
  @ApiProperty({ description: 'QR code string to check in' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ description: 'Staff name performing the check-in' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  staffName?: string;
}

export class ToggleCheckInDto {
  @ApiProperty({ description: 'Attended status' })
  @IsBoolean()
  attended: boolean;

  @ApiPropertyOptional({ description: 'Staff name performing the check-in' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  staffName?: string;
}

export class CancelRegistrationDto {
  @ApiPropertyOptional({ description: 'Reason for cancellation' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
