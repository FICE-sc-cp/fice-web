import {
  IsString,
  MaxLength,
  IsNotEmpty,
  IsUUID,
  IsOptional,
} from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  shortDescription: string;

  @IsUUID()
  @IsOptional()
  detailsId?: string;

  @IsUUID()
  @IsOptional()
  headId?: string;
}
