import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitCandidateDto {
  @ApiProperty({ maxLength: 120, example: 'Кіберпанк-самурай' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: 'Костюм створено власноруч із неоновими елементами' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '/uploads/abc-123.jpg' })
  @IsString()
  @IsNotEmpty()
  photoUrl: string;
}
