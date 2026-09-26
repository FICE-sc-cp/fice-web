import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JarPreviewEntity {
  @ApiProperty({
    enum: ['ok', 'unavailable'],
    description:
      'unavailable = Monobank did not answer right now; the link may still be valid',
  })
  status: 'ok' | 'unavailable';

  @ApiPropertyOptional({ example: '1234.56' })
  currentAmount?: string;

  @ApiPropertyOptional({ nullable: true, example: '50000' })
  goalAmount?: string | null;

  @ApiPropertyOptional({ nullable: true })
  jarUrl?: string | null;

  @ApiPropertyOptional()
  closed?: boolean;

  @ApiPropertyOptional({ description: 'Why Monobank is unavailable' })
  reason?: string;
}
