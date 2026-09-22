import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCandidateDto {
  @ApiProperty({ maxLength: 120, example: 'Михайло — Граф Дракула' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: 'Саморобний плащ та грим' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '/uploads/abc.jpg' })
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  order?: number;
}
