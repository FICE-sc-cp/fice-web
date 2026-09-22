import { ApiPropertyOptional } from '@nestjs/swagger';
import { VotingStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateVotingDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: VotingStatus })
  @IsOptional()
  @IsEnum(VotingStatus)
  status?: VotingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  onlyRegistered?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showResultsLive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowChangeVote?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowSubmissions?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  submissionsOpen?: boolean;
}
