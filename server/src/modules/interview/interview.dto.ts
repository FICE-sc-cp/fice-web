import { InterviewStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class BookSlotDto {
  @IsUUID()
  slotId: string;
}

export class CreateSlotsDto {
  @IsUUID()
  departmentId: string;

  /** Kyiv date, YYYY-MM-DD */
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  /** Kyiv time, HH:MM */
  @Matches(TIME)
  from: string;

  /** Kyiv time, HH:MM */
  @Matches(TIME)
  to: string;
}

export class TelegramTagDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  telegramTag: string;
}

export class AddCandidateDto extends TelegramTagDto {
  @IsUUID()
  departmentId: string;
}

export class SetStatusDto {
  @IsEnum(InterviewStatus)
  status: InterviewStatus;
}

export class AddNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text: string;
}

export class SetSlotMinutesDto {
  @IsInt()
  @Min(5)
  @Max(180)
  slotMinutes: number;
}
