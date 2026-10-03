import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  NotFoundException,
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
import { REGISTER_LIMIT_PER_IP, THROTTLE_TTL } from '../../common/throttle';
import { Admin } from '../../auth/admin.decorator';
import { AdminAccessService } from '../../auth/admin-access.service';
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
import {
  CancelRegistrationDto,
  ScanCheckInDto,
  ToggleCheckInDto,
} from './dto/check-in.dto';
import { RejectPaymentDto } from './dto/reject-payment.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventEntity } from './entities/event.entity';
import { EventService, SESSION_TOKEN_PATTERN } from './event.service';

@ApiTags('events')
@Controller('event')
export class EventController {
  constructor(
    private readonly eventService: EventService,
    private readonly configService: ConfigService,
    private readonly adminAccess: AdminAccessService,
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
  async findAll(
    @Query() query: EventQueryDto,
    @Headers('x-telegram-init-data') initData?: string,
  ) {
    return this.eventService.findAll(
      query,
      query.past,
      query.abitfest,
      await this.adminAccess.draftsAllowed(query.draft, initData),
    );
  }

  @Get('registration-session/:token')
  @ApiOperation({ summary: 'Check status of pending web registration session' })
  getRegistrationSession(@Param('token') token: string) {
    if (!SESSION_TOKEN_PATTERN.test(token)) {
      throw new BadRequestException('Invalid session token');
    }
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
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-telegram-init-data') initData?: string,
  ) {
    const event = await this.eventService.findOne(id);
    if (event.isDraft && !(await this.adminAccess.isAdmin(initData))) {
      throw new NotFoundException(`Event ${id} not found`);
    }
    return event;
  }

  @Get(':id/checkin/access')
  @ApiOperation({
    summary: 'Check if user has check-in permissions for this event',
  })
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
    @Body() body: ScanCheckInDto,
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
    @Body() body: ToggleCheckInDto,
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
  @Throttle({ default: { limit: REGISTER_LIMIT_PER_IP, ttl: THROTTLE_TTL } })
  @ApiOperation({ summary: 'Register for an event (public)' })
  register(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateEventRegistrationDto,
    @Headers('x-telegram-init-data') initData?: string,
  ) {
    return this.eventService.register(id, dto, initData);
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
    @Body() body?: CancelRegistrationDto,
  ) {
    return this.eventService.cancelRegistration(
      id,
      registrationId,
      body?.reason,
    );
  }
}
