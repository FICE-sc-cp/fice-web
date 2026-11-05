import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { resolveValidatedTelegramUser } from '../../auth/init-data.util';
import { MerchBotService } from '../../bot/merch-bot.service';

/**
 * Administrator or creator of the bound chat, by init data of the merch bot.
 * Web tokens never pass. Guards run before interceptors, so an unauthorised
 * upload never reaches multer.
 */
@Injectable()
export class MerchAdminGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly bot: MerchBotService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.config.get('AUTH_DISABLED') === 'true') return true;
    const req = context.switchToHttp().getRequest<Request>();
    const initData = req.headers['x-telegram-init-data'];
    const user = resolveValidatedTelegramUser(
      this.config,
      typeof initData === 'string' ? initData : undefined,
      undefined,
      ['MERCH_BOT_TOKEN'],
    );
    if (!(await this.bot.isShopAdmin(Number(user.telegramId)))) {
      throw new ForbiddenException('Немає доступу до адмінки.');
    }
    return true;
  }
}
