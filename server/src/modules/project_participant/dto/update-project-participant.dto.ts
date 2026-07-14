import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateProjectParticipantDto } from './create-project-participant.dto';

export class UpdateProjectParticipantDto extends PartialType(
  CreateProjectParticipantDto,
) {
  @ApiPropertyOptional({ description: 'Приховати з публічного списку' })
  @IsOptional()
  @IsBoolean()
  hidden?: boolean;
}
