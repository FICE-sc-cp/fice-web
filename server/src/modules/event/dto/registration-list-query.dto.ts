import { ApiPropertyOptional } from '@nestjs/swagger';
import { RegistrationSource } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const REGISTRATION_PAYMENT_FILTERS = [
  'PENDING',
  'CONFIRMED',
  'REJECTED',
  'AT_EVENT',
] as const;
export type RegistrationPaymentFilter =
  (typeof REGISTRATION_PAYMENT_FILTERS)[number];

export class RegistrationListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: REGISTRATION_PAYMENT_FILTERS })
  @IsOptional()
  @IsIn(REGISTRATION_PAYMENT_FILTERS)
  payment?: RegistrationPaymentFilter;

  @ApiPropertyOptional({ enum: RegistrationSource })
  @IsOptional()
  @IsEnum(RegistrationSource)
  source?: RegistrationSource;

  @ApiPropertyOptional({ description: 'true — attended, false — not yet' })
  @IsOptional()
  @Transform(({ value }): boolean | undefined => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  attended?: boolean;

  @ApiPropertyOptional({
    description: 'Name, group, @tag, answer text or ticket code prefix',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
