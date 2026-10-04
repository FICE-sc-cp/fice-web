import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DepartmentMemberRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PhotoFocusDto } from '../../../common/dto/photo-focus.dto';

const blankToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class CreateDepartmentMemberDto extends PhotoFocusDto {
  @ApiProperty({ enum: DepartmentMemberRole })
  @IsEnum(DepartmentMemberRole)
  role: DepartmentMemberRole;

  @ApiProperty({ maxLength: 30 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  firstName: string;

  @ApiProperty({ maxLength: 30 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  lastName: string;

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Напрям/спеціалізація (напр. для заступників)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialization?: string;

  @ApiPropertyOptional({
    maxLength: 100,
    nullable: true,
    description:
      'Посада на сайті, напр. «Заступниця голови з внутрішньої роботи»',
  })
  @Transform(blankToNull)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string | null;

  @ApiPropertyOptional({
    maxLength: 1000,
    nullable: true,
    description: 'Опис обовʼязків для сторінки президії',
  })
  @Transform(blankToNull)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 1000,
    description: 'Порядок у межах ролі (менше — раніше)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  order?: number;

  @ApiPropertyOptional({ description: 'URL фото учасника' })
  @IsOptional()
  @IsString()
  photo?: string;

  @ApiPropertyOptional({ maxLength: 50, description: 'Telegram-тег' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  telegramTag?: string;
}
