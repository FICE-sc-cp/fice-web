import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Admin } from '../../auth/admin.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { BroadcastService } from './broadcast.service';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';

@ApiTags('broadcast')
@Controller('broadcast')
@Admin()
export class BroadcastController {
  constructor(private readonly broadcastService: BroadcastService) {}

  @Post('event/:eventId')
  @ApiOperation({ summary: 'Send broadcast to attendees of a specific event (admin)' })
  broadcastToEvent(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateBroadcastDto,
  ) {
    return this.broadcastService.broadcastToEvent(eventId, dto);
  }

  @Get('event/:eventId/preview')
  @ApiOperation({ summary: 'Get attendee count with Telegram ID for event broadcast (admin)' })
  getEventPreview(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.broadcastService.getEventPreview(eventId);
  }

  @Post('global')
  @ApiOperation({ summary: 'Send global broadcast to all bot users (admin)' })
  broadcastToAll(@Body() dto: CreateBroadcastDto) {
    return this.broadcastService.broadcastToAll(dto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get bot broadcast audience stats (admin)' })
  getStats() {
    return this.broadcastService.getStats();
  }

  @Get('history')
  @ApiOperation({ summary: 'Get broadcast history (admin)' })
  getHistory(@Query() query: PaginationQueryDto) {
    return this.broadcastService.getHistory(query.page, query.limit);
  }
}
