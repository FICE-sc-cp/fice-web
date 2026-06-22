import { ApiPropertyOptional } from '@nestjs/swagger';

export class DonationEntity {
  id: string;
  fundraiserId: string;

  @ApiPropertyOptional({ nullable: true })
  name: string | null;

  amount: string;

  @ApiPropertyOptional({ nullable: true })
  comment: string | null;

  createdAt: Date;
}
