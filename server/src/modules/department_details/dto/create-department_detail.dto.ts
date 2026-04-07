import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateDepartmentDetailDto {
  @IsString()
  @IsNotEmpty()
  about: string;

  @IsString()
  @IsNotEmpty()
  detailedDescription: string;

  @IsString()
  @IsOptional()
  exampleOfWork?: string;
}
