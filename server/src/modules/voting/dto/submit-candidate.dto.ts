import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { OWN_IMAGE_URL } from '../../../upload/own-upload';

export class SubmitCandidateDto {
  @ApiProperty({ maxLength: 120, example: 'Кіберпанк-самурай' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({
    example: 'Костюм створено власноруч із неоновими елементами',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ example: '/uploads/abc-123.jpg' })
  @IsString()
  @IsNotEmpty()
  @Matches(OWN_IMAGE_URL, {
    message: 'Фото потрібно завантажити через форму заявки',
  })
  photoUrl: string;
}
