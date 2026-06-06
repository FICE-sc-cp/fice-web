import { PartialType } from '@nestjs/swagger';
import { CreateEventDetailsDto } from './create-event-details.dto';

export class UpdateEventDetailsDto extends PartialType(CreateEventDetailsDto) {}
