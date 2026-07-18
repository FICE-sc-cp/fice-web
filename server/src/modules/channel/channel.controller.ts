import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Admin } from '../../auth/admin.decorator';
import { ChannelService } from './channel.service';
import { CreateChannelPostDto } from './dto/create-channel-post.dto';

@ApiTags('channel')
@Controller('channel')
export class ChannelController {
  constructor(private readonly channelService: ChannelService) {}

  @Get('status')
  @Admin()
  @ApiOperation({ summary: 'Whether channel publishing is configured (admin)' })
  status() {
    return this.channelService.status();
  }

  @Post('post')
  @Admin()
  @ApiOperation({
    summary: 'Publish a post to the Telegram channel with an optional button',
  })
  post(@Body() dto: CreateChannelPostDto) {
    return this.channelService.post(dto);
  }
}
