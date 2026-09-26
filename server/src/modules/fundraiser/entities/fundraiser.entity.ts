import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FundraiserStatus } from '@prisma/client';

export class FundraiserEntity {
  id: string;
  name: string;

  @ApiProperty({ enum: FundraiserStatus })
  status: FundraiserStatus;

  description: string;

  @ApiPropertyOptional({ nullable: true })
  story: string | null;

  @ApiPropertyOptional({ nullable: true })
  imageUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  location: string | null;

  goalAmount: string;
  currentAmount: string;

  @ApiPropertyOptional({ nullable: true })
  cardNumber: string | null;

  @ApiPropertyOptional({ nullable: true })
  jarUrl: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Monobank jar widget link' })
  jarWidgetUrl: string | null;

  @ApiProperty({
    description: 'Whether the linked jar has its own goal (then goalAmount comes from the jar)',
  })
  jarHasGoal: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Last successful sync with the jar',
  })
  jarSyncedAt: Date | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Why the jar sync stopped; the admin must fix the link',
  })
  jarSyncError: string | null;

  @ApiPropertyOptional({ nullable: true })
  startDate: Date | null;

  @ApiPropertyOptional({ nullable: true })
  endDate: Date | null;
  detailsLink: string | null;
}
