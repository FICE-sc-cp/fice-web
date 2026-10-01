import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Admin } from '../../auth/admin.decorator';
import {
  extractTelegramUser,
  resolveValidatedTelegramUser,
} from '../../auth/init-data.util';
import { ApiPaginatedResponse } from '../../common/dto/paginated.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AddEventPartnerDto } from './dto/add-event-partner.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { CreateEventRegistrationDto } from './dto/create-event-registration.dto';
import { RejectPaymentDto } from './dto/reject-payment.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventEntity } from './entities/event.entity';
import { EventService } from './event.service';

@ApiTags('events')
@Controller('event')
export class EventController {
  constructor(
    private readonly eventService: EventService,
    private readonly configService: ConfigService,
  ) {}

  private resolveTelegramUser(
    initData?: string,
    queryTgUserId?: string,
    queryTgTag?: string,
  ): { telegramId?: bigint; username?: string; staffName?: string } {
    return resolveValidatedTelegramUser(this.configService, initData, {
      id: queryTgUserId,
      tag: queryTgTag,
    });
  }

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
  findAll(@Query() query: EventQueryDto) {
    return this.eventService.findAll(query, query.past, query.abitfest, query.draft);
  }

  @Get('registration-session/:token')
  @ApiOperation({ summary: 'Check status of pending web registration session' })
  getRegistrationSession(@Param('token', ParseUUIDPipe) token: string) {
    return this.eventService.getRegistrationSession(token);
  }

  @Get('checkin/events')
  @ApiOperation({ summary: 'List events where user has check-in permissions' })
  getCheckInEvents(
    @Headers('x-telegram-init-data') initData?: string,
    @Query('tgUserId') queryTgUserId?: string,
    @Query('tgTag') queryTgTag?: string,
  ) {
    const { telegramId, username } = this.resolveTelegramUser(
      initData,
      queryTgUserId,
      queryTgTag,
    );
    return this.eventService.getCheckInEvents(telegramId, username);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an event by id' })
  @ApiOkResponse({ type: EventEntity })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventService.findOne(id);
  }

  @Get(':id/checkin/access')
  @ApiOperation({ summary: 'Check if user has check-in permissions for this event' })
  getCheckInAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-telegram-init-data') initData?: string,
    @Query('tgUserId') queryTgUserId?: string,
    @Query('tgTag') queryTgTag?: string,
  ) {
    const { telegramId, username } = this.resolveTelegramUser(
      initData,
      queryTgUserId,
      queryTgTag,
    );
    return this.eventService.getCheckInAccess(id, telegramId, username);
  }

  @Get(':id/checkin/list')
  @ApiOperation({ summary: 'List registrations with attendance for check-in' })
  getCheckInList(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-telegram-init-data') initData?: string,
    @Query('tgUserId') queryTgUserId?: string,
    @Query('tgTag') queryTgTag?: string,
  ) {
    const { telegramId, username } = this.resolveTelegramUser(
      initData,
      queryTgUserId,
      queryTgTag,
    );
    return this.eventService.getCheckInList(id, telegramId, username);
  }

  @Post(':id/checkin/scan')
  @ApiOperation({ summary: 'Scan permanent QR code to check in a participant' })
  scanCheckIn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { code: string; staffName?: string },
    @Headers('x-telegram-init-data') initData?: string,
    @Query('tgUserId') queryTgUserId?: string,
    @Query('tgTag') queryTgTag?: string,
  ) {
    const { telegramId, username, staffName } = this.resolveTelegramUser(
      initData,
      queryTgUserId,
      queryTgTag,
    );
    return this.eventService.checkInByCode(
      id,
      body.code,
      telegramId,
      username,
      staffName || body.staffName,
    );
  }

  @Post(':id/checkin/:registrationId')
  @ApiOperation({ summary: 'Toggle or set attended status for a participant' })
  toggleCheckIn(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('registrationId', ParseUUIDPipe) registrationId: string,
    @Body() body: { attended: boolean; staffName?: string },
    @Headers('x-telegram-init-data') initData?: string,
    @Query('tgUserId') queryTgUserId?: string,
    @Query('tgTag') queryTgTag?: string,
  ) {
    const { telegramId, username, staffName } = this.resolveTelegramUser(
      initData,
      queryTgUserId,
      queryTgTag,
    );
    return this.eventService.toggleCheckIn(
      id,
      registrationId,
      body.attended,
      telegramId,
      username,
      staffName || body.staffName,
    );
  }

  @Post(':id/registrations/:registrationId/confirm-payment')
  @Admin()
  @ApiOperation({
    summary: 'Confirm participant payment and send permanent QR ticket',
  })
  confirmPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('registrationId', ParseUUIDPipe) registrationId: string,
    @Headers('x-telegram-init-data') initData?: string,
  ) {
    const user = initData ? extractTelegramUser(initData) : null;
    return this.eventService.confirmPayment(
      id,
      registrationId,
      user?.id ? BigInt(user.id) : undefined,
      user?.username,
    );
  }

  @Post(':id/registrations/:registrationId/reject-payment')
  @Admin()
  @ApiOperation({ summary: 'Reject participant payment with optional reason' })
  rejectPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('registrationId', ParseUUIDPipe) registrationId: string,
    @Body() body: RejectPaymentDto,
    @Headers('x-telegram-init-data') initData?: string,
  ) {
    const user = initData ? extractTelegramUser(initData) : null;
    return this.eventService.rejectPayment(
      id,
      registrationId,
      body.reason,
      user?.id ? BigInt(user.id) : undefined,
      user?.username,
    );
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

  @Delete(':id/registrations/:registrationId')
  @Admin()
  @ApiOperation({ summary: 'Cancel event registration (admin)' })
  cancelRegistration(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('registrationId', ParseUUIDPipe) registrationId: string,
    @Body() body?: { reason?: string },
  ) {
    return this.eventService.cancelRegistration(id, registrationId, body?.reason);
  }
}
