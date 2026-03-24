import { PartialType } from '@nestjs/swagger';
import { CreateFundraiserDto } from './create-fundraiser.dto';

export class UpdateFundraiserDto extends PartialType(CreateFundraiserDto) {}
