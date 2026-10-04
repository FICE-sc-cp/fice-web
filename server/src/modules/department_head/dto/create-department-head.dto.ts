import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PhotoFocusDto } from '../../../common/dto/photo-focus.dto';

export class CreateDepartmentHeadDto extends PhotoFocusDto {
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

  @ApiPropertyOptional({ description: 'Photo URL' })
  @IsOptional()
  @IsString()
  photo?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobDescription?: string;

  @ApiPropertyOptional({ maxLength: 50, example: '@head_tag' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  telegramTag?: string;
}
