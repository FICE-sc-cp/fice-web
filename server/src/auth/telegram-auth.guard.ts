import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parse, validate } from '@tma.js/init-data-node';
import { Request } from 'express';
import { BotService } from '../bot/bot.service';

@Injectable()
export class TelegramAuthGuard implements CanActivate {
  private readonly logger = new Logger(TelegramAuthGuard.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly botService: BotService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.configService.get<string>('AUTH_DISABLED') === 'true') {
      return true;
    }

    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.error(
        'TELEGRAM_BOT_TOKEN is not set — rejecting protected request. ' +
          'Set the token, or AUTH_DISABLED=true for local development.',
      );
      throw new UnauthorizedException('Admin authentication is not configured');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const initData = request.headers['x-telegram-init-data'];

    if (!initData || typeof initData !== 'string') {
      throw new UnauthorizedException('Missing Telegram init data');
    }

    try {
      validate(initData, token);
    } catch {
      throw new UnauthorizedException('Invalid Telegram init data');
    }

    const groupId = this.configService.get<string>('ADMIN_GROUP_CHAT_ID');
    if (!groupId) {
      this.logger.warn(
        'ADMIN_GROUP_CHAT_ID is not set — allowing any authenticated Telegram ' +
          'user. Set it to restrict writes to members of your admin group.',
      );
      return true;
    }

    const userId = parse(initData).user?.id;
    if (!userId) {
      throw new UnauthorizedException(
        'Telegram init data does not contain a user',
      );
    }

    const isMember = await this.botService.isUserInChat(groupId, userId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of the admin group');
    }

    return true;
  }
}
