import { ApiPropertyOptional } from '@nestjs/swagger';
import { FundraiserStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class FundraiserQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: FundraiserStatus })
  @IsOptional()
  @IsEnum(FundraiserStatus)
  status?: FundraiserStatus;

  @ApiPropertyOptional({ description: 'true — include drafts (admin only)' })
  @IsOptional()
  @Transform(({ value }): boolean | undefined => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  draft?: boolean;
}
