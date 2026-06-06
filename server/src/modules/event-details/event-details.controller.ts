import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Admin } from '../../auth/admin.decorator';
import { CreateEventDetailsDto } from './dto/create-event-details.dto';
import { UpdateEventDetailsDto } from './dto/update-event-details.dto';
import { EventDetailsEntity } from './entities/event-details.entity';
import { EventDetailsService } from './event-details.service';

@ApiTags('event-details')
@Controller('event-details')
export class EventDetailsController {
  constructor(private readonly eventDetailsService: EventDetailsService) {}

  @Post()
  @Admin()
  @ApiOperation({ summary: 'Create event details (admin)' })
  @ApiCreatedResponse({ type: EventDetailsEntity })
  create(@Body() dto: CreateEventDetailsDto) {
    return this.eventDetailsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List event details' })
  @ApiOkResponse({ type: [EventDetailsEntity] })
  findAll() {
    return this.eventDetailsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event details by id' })
  @ApiOkResponse({ type: EventDetailsEntity })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventDetailsService.findOne(id);
  }

  @Patch(':id')
  @Admin()
  @ApiOperation({ summary: 'Update event details (admin)' })
  @ApiOkResponse({ type: EventDetailsEntity })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDetailsDto,
  ) {
    return this.eventDetailsService.update(id, dto);
  }

  @Delete(':id')
  @Admin()
  @ApiOperation({ summary: 'Delete event details (admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventDetailsService.remove(id);
  }
}
