import { ApiPropertyOptional } from '@nestjs/swagger';
import { FundraiserStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class FundraiserQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: FundraiserStatus })
  @IsOptional()
  @IsEnum(FundraiserStatus)
  status?: FundraiserStatus;
}
