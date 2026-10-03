import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RegistrationPayment, RegistrationSource } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { OWN_UPLOAD_URL } from '../../../upload/own-upload';

export class EventAnswerDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  questionId: string;

  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  value: string;
}

export class CreateEventRegistrationDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ maxLength: 50, example: '@username' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  telegramTag: string;

  @ApiProperty({ maxLength: 10, example: 'ІП-31' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  group: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  birthDate?: Date;

  @ApiPropertyOptional({ enum: RegistrationPayment })
  @IsOptional()
  @IsEnum(RegistrationPayment)
  payment?: RegistrationPayment;

  @ApiPropertyOptional({
    enum: RegistrationSource,
    default: RegistrationSource.WEB,
  })
  @IsOptional()
  @IsEnum(RegistrationSource)
  source?: RegistrationSource;

  @ApiPropertyOptional({
    description: 'Uploaded receipt URL when payment = DONATED',
  })
  @IsOptional()
  @IsString()
  @Matches(OWN_UPLOAD_URL, {
    message: 'Квитанцію потрібно завантажити через форму реєстрації',
  })
  receiptUrl?: string;

  @ApiPropertyOptional({ description: 'Telegram User ID for bot linking' })
  @IsOptional()
  telegramUserId?: string | number;

  @ApiPropertyOptional({ description: 'Save profile for next registrations' })
  @IsOptional()
  saveProfile?: boolean;

  @ApiPropertyOptional({ description: 'Phone number', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;

  @ApiPropertyOptional({ type: [EventAnswerDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => EventAnswerDto)
  answers?: EventAnswerDto[];
}
