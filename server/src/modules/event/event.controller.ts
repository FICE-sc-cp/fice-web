import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Admin } from '../../auth/admin.decorator';
import { ApiPaginatedResponse } from '../../common/dto/paginated.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AddEventPartnerDto } from './dto/add-event-partner.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventEntity } from './entities/event.entity';
import { EventService } from './event.service';

@ApiTags('events')
@Controller('event')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post()
  @Admin()
  @ApiOperation({ summary: 'Create an event (admin)' })
  @ApiCreatedResponse({ type: EventEntity })
  create(@Body() dto: CreateEventDto) {
    return this.eventService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List events with details and partners' })
  @ApiPaginatedResponse(EventEntity)
  findAll(@Query() pagination: PaginationQueryDto) {
    return this.eventService.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an event by id' })
  @ApiOkResponse({ type: EventEntity })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventService.findOne(id);
  }

  @Patch(':id')
  @Admin()
  @ApiOperation({ summary: 'Update an event (admin)' })
  @ApiOkResponse({ type: EventEntity })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEventDto) {
    return this.eventService.update(id, dto);
  }

  @Delete(':id')
  @Admin()
  @ApiOperation({ summary: 'Delete an event (admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventService.remove(id);
  }

  @Post(':id/partners')
  @Admin()
  @ApiOperation({ summary: 'Attach a partner to an event (admin)' })
  addPartner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddEventPartnerDto,
  ) {
    return this.eventService.addPartner(id, dto.partnerId);
  }

  @Delete(':id/partners/:partnerId')
  @Admin()
  @ApiOperation({ summary: 'Detach a partner from an event (admin)' })
  removePartner(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('partnerId', ParseUUIDPipe) partnerId: string,
  ) {
    return this.eventService.removePartner(id, partnerId);
  }
}
