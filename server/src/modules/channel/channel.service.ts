import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { BotService } from '../../bot/bot.service';
import { UserBotService } from '../../bot/user-bot.service';
import { CreateChannelPostDto } from './dto/create-channel-post.dto';

@Injectable()
export class ChannelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: BotService,
    private readonly userBot: UserBotService,
    private readonly config: ConfigService,
  ) {}

  status() {
    const channelIdSet = !!this.config.get<string>('TELEGRAM_CHANNEL_ID');
    const botTokenSet = !!this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const webUrlSet = !!this.config.get<string>('PUBLIC_WEB_URL');
    const publicWebUrl = this.config.get<string>('PUBLIC_WEB_URL') || '';
    const botUsername =
      this.config.get<string>('USER_BOT_USERNAME') ||
      this.userBot.getUsername() ||
      'fice_event_bot';
    const appName = this.config.get<string>('USER_MINI_APP_NAME') || 'app';
    return {
      configured: channelIdSet && botTokenSet,
      channelIdSet,
      botTokenSet,
      webUrlSet,
      publicWebUrl,
      botUsername,
      appName,
    };
  }

  async post(dto: CreateChannelPostDto) {
    let photoUrl = dto.imageUrl;
    let button: { text: string; url: string } | undefined;

    if (dto.eventId) {
      const event = await this.prisma.event.findUnique({
        where: { id: dto.eventId },
        select: { id: true, photoUrl: true },
      });
      if (!event) {
        throw new NotFoundException(`Event ${dto.eventId} not found`);
      }
      // Fall back to the event cover if the composer didn't set an image.
      if (!photoUrl) photoUrl = event.photoUrl ?? undefined;
    }

    if (dto.buttonUrl) {
      button = { text: dto.buttonText?.trim() || 'Перейти', url: dto.buttonUrl.trim() };
    } else if (dto.eventId) {
      const botUsername =
        this.config.get<string>('USER_BOT_USERNAME') ||
        this.userBot.getUsername();
      const appName = this.config.get<string>('USER_MINI_APP_NAME') || 'app';

      if (botUsername && appName) {
        button = {
          text: dto.buttonText?.trim() || 'Зареєструватися',
          url: `https://t.me/${botUsername}/${appName}?startapp=event_${dto.eventId}`,
        };
      } else if (botUsername) {
        button = {
          text: dto.buttonText?.trim() || 'Зареєструватися',
          url: `https://t.me/${botUsername}?start=event_${dto.eventId}`,
        };
      } else {
        const base = this.config.get<string>('PUBLIC_WEB_URL');
        if (!base) {
          throw new ServiceUnavailableException(
            'PUBLIC_WEB_URL не налаштовано — не можу зібрати посилання на реєстрацію.',
          );
        }
        button = {
          text: dto.buttonText?.trim() || 'Зареєструватися',
          url: `${base.replace(/\/$/, '')}/events/${dto.eventId}#register`,
        };
      }
    }

    const { messageId } = await this.bot.postToChannel({
      text: dto.text,
      photoUrl,
      button,
    });
    return { ok: true, messageId };
  }
}
