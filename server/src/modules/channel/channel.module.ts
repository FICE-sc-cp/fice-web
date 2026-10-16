import { Module } from '@nestjs/common';
import { ChannelController } from './channel.controller';
import { ChannelService } from './channel.service';
import { PostCommandsService } from './post-commands.service';
import { PublishAccessService } from './publish-access.service';

@Module({
  controllers: [ChannelController],
  providers: [ChannelService, PublishAccessService, PostCommandsService],
})
export class ChannelModule {}
