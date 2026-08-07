import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventQuestionType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class EventProgramItemDto {
  @ApiProperty({ maxLength: 20, example: '17:00' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  time: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  order?: number;
}

export class EventQuestionDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Existing question id (omit to create)' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label: string;

  @ApiProperty({ enum: EventQuestionType })
  @IsEnum(EventQuestionType)
  type: EventQuestionType;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Choices for SINGLE_CHOICE' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  order?: number;
}

export class CreateEventDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  date: Date;

  @ApiPropertyOptional({ description: 'Cover photo URL' })
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ description: 'About text shown on the event page' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @ApiPropertyOptional({ description: 'Google Maps link for the location' })
  @IsOptional()
  @IsString()
  locationNote?: string;

  @ApiPropertyOptional({ maxLength: 120, description: 'e.g. "Збір з 16:30"' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  timeNote?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  registrationCloseDate?: Date;

  @ApiPropertyOptional({ description: 'Link to a photo album of the event' })
  @IsOptional()
  @IsString()
  photoAlbumUrl?: string;

  @ApiPropertyOptional({ description: 'Online contribution amount; omit/0 for a free event' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  feeAmount?: number;

  @ApiPropertyOptional({ description: 'Contribution amount when paying at the event' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  feeAtEventAmount?: number;

  @ApiPropertyOptional({ maxLength: 255, description: 'Donate requisites shown when paying' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  feeRequisites?: string;

  @ApiPropertyOptional({ description: 'Show this event on the applicants page' })
  @IsOptional()
  @IsBoolean()
  isAbitfest?: boolean;

  @ApiPropertyOptional({ description: 'Event has no registration form' })
  @IsOptional()
  @IsBoolean()
  noRegistration?: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  detailsId?: string;

  @ApiPropertyOptional({ type: [EventProgramItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventProgramItemDto)
  program?: EventProgramItemDto[];

  @ApiPropertyOptional({ type: [EventQuestionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventQuestionDto)
  questions?: EventQuestionDto[];
}
