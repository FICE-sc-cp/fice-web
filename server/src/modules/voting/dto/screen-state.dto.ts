import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export const SCREEN_MODES = ['live', 'closed', 'ceremony'] as const;
export const SCREEN_THEMES = ['fice', 'ny', 'hw', 'ball'] as const;
export const SCREEN_VIEWS = ['auto', 'grid', 'show'] as const;

/** A change to the stage screen sent from the admin remote. */
export class UpdateScreenStateDto {
  @ApiPropertyOptional({ enum: SCREEN_MODES })
  @IsOptional()
  @IsIn(SCREEN_MODES)
  mode?: (typeof SCREEN_MODES)[number];

  @ApiPropertyOptional({ enum: SCREEN_THEMES })
  @IsOptional()
  @IsIn(SCREEN_THEMES)
  theme?: (typeof SCREEN_THEMES)[number];

  @ApiPropertyOptional({ enum: SCREEN_VIEWS })
  @IsOptional()
  @IsIn(SCREEN_VIEWS)
  view?: (typeof SCREEN_VIEWS)[number];

  @ApiPropertyOptional({ description: 'Ceremony step to show' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  step?: number;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Partner award to show over the ceremony; null hides it',
  })
  @IsOptional()
  @IsUUID()
  award?: string | null;

  @ApiPropertyOptional({ description: "Reveal the shown award's pick" })
  @IsOptional()
  @IsBoolean()
  awardOpen?: boolean;

  @ApiPropertyOptional({ enum: [-1, 1], description: 'Previous / next photo' })
  @IsOptional()
  @IsIn([-1, 1])
  nav?: -1 | 1;

  @ApiPropertyOptional({ description: 'Fire the salute once' })
  @IsOptional()
  @IsBoolean()
  salute?: boolean;
}
