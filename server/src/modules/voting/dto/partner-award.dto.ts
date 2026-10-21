import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePartnerAwardDto {
  @ApiProperty({ format: 'uuid', description: 'EventPartner of this event' })
  @IsUUID()
  eventPartnerId: string;

  @ApiProperty({ maxLength: 80, example: 'Вибір партнера' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title: string;

  @ApiPropertyOptional({ maxLength: 160, example: 'Сертифікат на 1000 грн' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  prize?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Partner picks via the link (false: the organizer enters it)',
  })
  @IsOptional()
  @IsBoolean()
  partnerPicks?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  showLogo?: boolean;
}

export class UpdatePartnerAwardDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @ApiPropertyOptional({ maxLength: 160, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  prize?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  partnerPicks?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showLogo?: boolean;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Pick entered by the organizer; null clears it',
  })
  @IsOptional()
  @IsUUID()
  candidateId?: string | null;
}

export class ReorderPartnerAwardsDto {
  @ApiProperty({
    type: [String],
    description: 'All award ids in the new order',
  })
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  ids: string[];
}
