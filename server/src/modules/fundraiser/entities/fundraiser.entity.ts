import { ApiProperty } from '@nestjs/swagger';
import { FundraiserStatus } from '@prisma/client';

export class FundraiserEntity {
  id: string;
  name: string;

  @ApiProperty({ enum: FundraiserStatus })
  status: FundraiserStatus;

  description: string;
  /** Decimal serialized as a string. */
  goalAmount: string;
  /** Decimal serialized as a string. */
  currentAmount: string;
  startDate: Date;
  endDate: Date;
  detailsLink: string | null;
}
