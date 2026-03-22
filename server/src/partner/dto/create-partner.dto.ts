import { IsString, IsNotEmpty, IsUrl, IsOptional } from 'class-validator';

export class CreatePartnerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUrl()
  @IsOptional()
  website?: string;
}
