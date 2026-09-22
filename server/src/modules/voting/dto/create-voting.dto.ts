import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateVotingDto {
  @ApiProperty({ maxLength: 120, example: 'Найкращий гелловінський костюм' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @ApiPropertyOptional({ example: 'Оберіть найбільш вражаючий костюм вечора!' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  onlyRegistered?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  showResultsLive?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowChangeVote?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowSubmissions?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  submissionsOpen?: boolean;
}
