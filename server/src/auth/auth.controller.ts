import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { parse, validate } from '@tma.js/init-data-node';
import { BotService } from '../bot/bot.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly botService: BotService,
  ) {}

  @Get('me')
  @ApiSecurity('telegram')
  @ApiOperation({
    summary: 'Resolve the current Telegram user and whether they are an admin',
  })
  async me(@Headers('x-telegram-init-data') initData?: string) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token || !initData) {
      throw new UnauthorizedException('Missing Telegram init data');
    }

    try {
      validate(initData, token);
    } catch {
      throw new UnauthorizedException('Invalid Telegram init data');
    }

    const user = parse(initData).user;
    if (!user) {
      throw new UnauthorizedException(
        'Telegram init data does not contain a user',
      );
    }

    const groupId = this.configService.get<string>('ADMIN_GROUP_CHAT_ID');
    const isAdmin = groupId
      ? await this.botService.isUserInChat(groupId, user.id)
      : true;

    return {
      id: user.id,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      isAdmin,
    };
  }
}
