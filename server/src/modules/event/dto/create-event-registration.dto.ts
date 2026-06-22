import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RegistrationPayment } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class EventAnswerDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  questionId: string;

  @ApiProperty()
  @IsString()
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

  @ApiPropertyOptional({ description: 'Uploaded receipt URL when payment = DONATED' })
  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @ApiPropertyOptional({ type: [EventAnswerDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventAnswerDto)
  answers?: EventAnswerDto[];
}
