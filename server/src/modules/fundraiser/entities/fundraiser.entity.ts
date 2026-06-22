import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FundraiserStatus } from '@prisma/client';
import { DonationEntity } from './donation.entity';

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
  donationsCount: number;

  @ApiPropertyOptional({ nullable: true })
  cardNumber: string | null;

  @ApiPropertyOptional({ nullable: true })
  jarUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  monoJarId: string | null;

  startDate: Date;
  endDate: Date;
  detailsLink: string | null;

  @ApiPropertyOptional({ type: [DonationEntity] })
  donations?: DonationEntity[];
}
