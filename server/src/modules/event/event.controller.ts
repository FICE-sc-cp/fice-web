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
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Admin } from '../../auth/admin.decorator';
import { ApiPaginatedResponse } from '../../common/dto/paginated.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AddEventPartnerDto } from './dto/add-event-partner.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateEventRegistrationDto } from './dto/create-event-registration.dto';
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
  @ApiOperation({ summary: 'Add a partner to an event (admin)' })
  addPartner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddEventPartnerDto,
  ) {
    return this.eventService.addPartner(id, dto);
  }

  @Delete(':id/partners/:eventPartnerId')
  @Admin()
  @ApiOperation({ summary: 'Remove a partner from an event (admin)' })
  removePartner(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('eventPartnerId', ParseUUIDPipe) eventPartnerId: string,
  ) {
    return this.eventService.removePartner(id, eventPartnerId);
  }

  @Post(':id/register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register for an event (public)' })
  register(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateEventRegistrationDto,
  ) {
    return this.eventService.register(id, dto);
  }

  @Get(':id/registrations')
  @Admin()
  @ApiOperation({ summary: 'List event registrations (admin)' })
  listRegistrations(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.eventService.listRegistrations(id, pagination);
  }

  @Get(':id/registrations/export')
  @Admin()
  @ApiOperation({ summary: 'Download event registrations as Excel (admin)' })
  async exportRegistrations(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.eventService.exportRegistrations(id);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="event-${id}-registrations.xlsx"`,
      'Content-Length': buffer.length.toString(),
    });
    res.send(buffer);
  }
}
