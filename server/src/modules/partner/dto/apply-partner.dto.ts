import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUrl, MaxLength } from 'class-validator';

export class ApplyPartnerDto {
  @ApiProperty({ maxLength: 100, description: 'Company or brand name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    maxLength: 300,
    description: 'Website or social media link',
    example: 'https://example.com',
  })
  @IsUrl()
  @MaxLength(300)
  websiteLink: string;

  @ApiProperty({
    maxLength: 100,
    description: 'Contact person name and position',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  contactName: string;

  @ApiProperty({
    maxLength: 150,
    description: 'Preferred way to get in touch',
    example: '@username / +380991234567',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  contactMethod: string;

  @ApiProperty({ maxLength: 5000, description: 'Proposed cooperation format' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  proposal: string;
}
