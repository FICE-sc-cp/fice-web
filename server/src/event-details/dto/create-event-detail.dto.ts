import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreateEventDetailDto {
  @IsNumber()
  @IsNotEmpty()
  eventId: number;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsString()
  @IsOptional()
  agenda?: string;
}
