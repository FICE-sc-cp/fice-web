import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsUrl,
  IsOptional,
} from 'class-validator';

export class CreateDepartmentHeadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  lastName: string;

  @IsString()
  @IsUrl()
  @IsOptional()
  photo?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  jobDescription: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  telegramTag: string;
}
