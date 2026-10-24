import { ApiProperty } from '@nestjs/swagger';
import { RegistrationPayment } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Someone an organizer registers by hand; the ticket goes to their Telegram. */
export class ManualRegistrationDto {
  @ApiProperty({ maxLength: 100, example: 'Іван Іваненко' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ maxLength: 10, example: 'ІП-31' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  group: string;

  @ApiProperty({ maxLength: 50, example: '@username' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  telegramTag: string;

  @ApiProperty({
    enum: RegistrationPayment,
    description: 'DONATED: paid online, the organizer has seen the payment',
  })
  @IsEnum(RegistrationPayment)
  payment: RegistrationPayment;
}
