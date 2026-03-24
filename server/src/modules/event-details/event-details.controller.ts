import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { EventDetailsService } from './event-details.service';
import { CreateEventDetailDto } from './dto/create-event-detail.dto';
import { UpdateEventDetailDto } from './dto/update-event-detail.dto';

@Controller('event-details')
export class EventDetailsController {
  constructor(private readonly eventDetailsService: EventDetailsService) {}

  @Post()
  create(@Body() createEventDetailDto: CreateEventDetailDto) {
    return this.eventDetailsService.create(createEventDetailDto);
  }

  @Get()
  findAll() {
    return this.eventDetailsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventDetailsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateEventDetailDto: UpdateEventDetailDto,
  ) {
    return this.eventDetailsService.update(id, updateEventDetailDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventDetailsService.remove(id);
  }
}
