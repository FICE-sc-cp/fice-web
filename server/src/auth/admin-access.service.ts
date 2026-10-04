import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validate } from '@tma.js/init-data-node';
import { BotService } from '../bot/bot.service';
import { extractTelegramUser } from './init-data.util';

@Injectable()
export class AdminAccessService {
  private readonly logger = new Logger(AdminAccessService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly botService: BotService,
  ) {}

  async assertAdmin(initData?: string): Promise<void> {
    if (this.configService.get<string>('AUTH_DISABLED') === 'true') return;

    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.error(
        'TELEGRAM_BOT_TOKEN is not set — rejecting protected request. ' +
          'Set the token, or AUTH_DISABLED=true for local development.',
      );
      throw new UnauthorizedException('Admin authentication is not configured');
    }
    if (!initData) {
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
      return;
    }

    const userId = extractTelegramUser(initData)?.id;
    if (!userId) {
      throw new UnauthorizedException(
        'Telegram init data does not contain a user',
      );
    }
    if (!(await this.botService.isUserInChat(groupId, userId))) {
      throw new ForbiddenException('You are not a member of the admin group');
    }
  }

  async isAdmin(initData?: string): Promise<boolean> {
    try {
      await this.assertAdmin(initData);
      return true;
    } catch (err) {
      if (
        err instanceof UnauthorizedException ||
        err instanceof ForbiddenException
      ) {
        return false;
      }
      throw err;
    }
  }

  async draftsAllowed(
    requested: boolean | undefined,
    initData?: string,
  ): Promise<boolean> {
    if (!requested) return false;
    if (!(await this.isAdmin(initData))) {
      throw new ForbiddenException('Чернетки доступні лише адміністраторам');
    }
    return true;
  }
}
