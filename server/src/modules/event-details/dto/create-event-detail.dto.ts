import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateEventDetailDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsString()
  @IsOptional()
  agenda?: string;
}
