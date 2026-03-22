import { PartialType } from '@nestjs/swagger';
import { CreateEventDetailDto } from './create-event-detail.dto';

export class UpdateEventDetailDto extends PartialType(CreateEventDetailDto) {}
