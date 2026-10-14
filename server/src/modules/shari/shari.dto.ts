import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const MAX_SHARA_QUANTITY = 50;

export class TeacherContactsDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  telegram?: string;
}

export class UpdateSharaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  bonus: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  condition?: string;

  @IsInt()
  @Min(1)
  @Max(MAX_SHARA_QUANTITY)
  quantity: number;
}

/** The same shara for each of the chosen groups. */
export class CreateShariDto extends UpdateSharaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  discipline: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  groups: string[];
}

export class AwardsDto {
  @IsArray()
  @ArrayMaxSize(MAX_SHARA_QUANTITY)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  names: string[];
}

export class AddTeacherDto extends TeacherContactsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName: string;
}

export class ShariSettingsDto {
  @IsOptional()
  @IsBoolean()
  teachersOpen?: boolean;

  @IsOptional()
  @IsBoolean()
  starostasOpen?: boolean;
}
