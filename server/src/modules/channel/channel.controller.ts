import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Admin } from '../../auth/admin.decorator';
import { extractTelegramUser } from '../../auth/init-data.util';
import { ChannelService } from './channel.service';
import { CreateChannelPostDto } from './dto/create-channel-post.dto';
import { PublisherDto } from './dto/publisher.dto';
import { UpdateChannelPostDto } from './dto/update-channel-post.dto';
import { PublishAccessService } from './publish-access.service';

@ApiTags('channel')
@Controller('channel')
export class ChannelController {
  constructor(
    private readonly channelService: ChannelService,
    private readonly access: PublishAccessService,
    private readonly config: ConfigService,
  ) {}

  @Get('status')
  @Admin()
  @ApiOperation({ summary: 'Whether channel publishing is configured (admin)' })
  status() {
    return this.channelService.status();
  }

  @Post('post')
  @Admin()
  @ApiOperation({
    summary:
      'Publish a post to the Telegram channel now or at publishAt, with an optional button',
  })
  post(
    @Body() dto: CreateChannelPostDto,
    @Headers('x-telegram-init-data') initData?: string,
  ) {
    return this.channelService.post(dto, this.author(initData));
  }

  @Get('queue')
  @Admin()
  @ApiOperation({
    summary: 'Scheduled channel posts and site news, soonest first (admin)',
  })
  queue() {
    return this.channelService.queue();
  }

  @Get('published')
  @Admin()
  @ApiOperation({
    summary: 'Latest published channel posts, still editable (admin)',
  })
  published() {
    return this.channelService.published();
  }

  @Patch('posts/:id')
  @Admin()
  @ApiOperation({
    summary:
      'Edit a queued channel post, or the text and button of a published one (admin)',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChannelPostDto,
  ) {
    return this.channelService.updatePost(id, dto);
  }

  @Post('posts/:id/publish')
  @Admin()
  @ApiOperation({ summary: 'Publish a queued channel post now (admin)' })
  async publish(@Param('id', ParseUUIDPipe) id: string) {
    return { result: await this.channelService.publishNow('channel', id) };
  }

  @Delete('posts/:id')
  @Admin()
  @ApiOperation({ summary: 'Take a channel post off the queue (admin)' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.channelService.remove('channel', id);
    return { ok: true };
  }

  @Get('publishers')
  @Admin()
  @ApiOperation({
    summary: 'Who may publish from the media chat without approval (admin)',
  })
  async publishers(@Headers('x-telegram-init-data') initData?: string) {
    return {
      publishers: await this.access.list(),
      canManage: await this.canManage(initData),
    };
  }

  @Post('publishers')
  @Admin()
  @ApiOperation({
    summary: 'Grant publishing (media department head or presidium)',
  })
  async addPublisher(
    @Body() dto: PublisherDto,
    @Headers('x-telegram-init-data') initData?: string,
  ) {
    await this.assertManager(initData);
    return this.access.add(dto.telegramTag, this.author(initData));
  }

  @Delete('publishers/:tag')
  @Admin()
  @ApiOperation({
    summary: 'Revoke publishing (media department head or presidium)',
  })
  async removePublisher(
    @Param('tag') tag: string,
    @Headers('x-telegram-init-data') initData?: string,
  ) {
    await this.assertManager(initData);
    await this.access.remove(tag);
    return { ok: true };
  }

  // The Admin guard has already validated the init data.
  private author(initData?: string): string | undefined {
    const user = initData ? extractTelegramUser(initData) : null;
    if (!user) return undefined;
    return user.username
      ? `@${user.username}`
      : [user.firstName, user.lastName].filter(Boolean).join(' ');
  }

  private async canManage(initData?: string): Promise<boolean> {
    if (this.config.get<string>('AUTH_DISABLED') === 'true') return true;
    const user = initData ? extractTelegramUser(initData) : null;
    return user ? this.access.isManager(user) : false;
  }

  private async assertManager(initData?: string) {
    if (!(await this.canManage(initData))) {
      throw new ForbiddenException(
        'Доступ видають лише голова департаменту медіа та президія',
      );
    }
  }
}
