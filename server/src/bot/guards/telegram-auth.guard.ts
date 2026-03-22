import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validate } from '@tma.js/init-data-node';
import { Request } from 'express';

@Injectable()
export class TelegramAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const initData = request.headers['x-telegram-init-data'] as string;

    if (!initData) {
      throw new UnauthorizedException('Missing Telegram init data');
    }

    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN')!;

    try {
      validate(initData, token);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid Telegram init data');
    }
  }
}
