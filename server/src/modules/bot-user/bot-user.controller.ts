import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { validate } from '@tma.js/init-data-node';
import { Admin } from '../../auth/admin.decorator';
import { extractTelegramUser } from '../../auth/init-data.util';
import { BotUserService } from './bot-user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('bot-user')
@Controller('bot-user')
export class BotUserController {
  constructor(
    private readonly botUserService: BotUserService,
    private readonly config: ConfigService,
  ) {}

  private resolveTelegramId(initData?: string, fallbackId?: string): bigint {
    if (this.config.get<string>('AUTH_DISABLED') === 'true' && fallbackId) {
      return BigInt(fallbackId);
    }

    const token =
      this.config.get<string>('USER_BOT_TOKEN') ||
      this.config.get<string>('TELEGRAM_BOT_TOKEN');

    if (!initData) {
      if (fallbackId && this.config.get<string>('AUTH_DISABLED') === 'true') {
        return BigInt(fallbackId);
      }
      throw new UnauthorizedException('Відсутні дані авторизації Telegram');
    }

    if (token) {
      try {
        validate(initData, token);
      } catch {
        // Fallback check: if token validation fails, let's also check if extracting user directly is allowed in dev
        if (this.config.get<string>('AUTH_DISABLED') !== 'true') {
          throw new UnauthorizedException('Невалідні дані Telegram');
        }
      }
    }

    const user = extractTelegramUser(initData);
    if (!user) {
      throw new UnauthorizedException('Не вдалося розпізнати користувача Telegram');
    }
    return BigInt(user.id);
  }

  @Get('profile')
  @ApiSecurity('telegram')
  @ApiOperation({ summary: 'Get current Telegram bot user profile' })
  getProfile(
    @Headers('x-telegram-init-data') initData?: string,
    @Query('tgUserId') fallbackId?: string,
  ) {
    const telegramId = this.resolveTelegramId(initData, fallbackId);
    return this.botUserService.getProfile(telegramId);
  }

  @Patch('profile')
  @ApiSecurity('telegram')
  @ApiOperation({ summary: 'Update Telegram bot user profile' })
  updateProfile(
    @Body() dto: UpdateProfileDto,
    @Headers('x-telegram-init-data') initData?: string,
    @Query('tgUserId') fallbackId?: string,
  ) {
    const telegramId = this.resolveTelegramId(initData, fallbackId);
    return this.botUserService.updateProfile(telegramId, dto);
  }

  @Get('registrations')
  @ApiSecurity('telegram')
  @ApiOperation({ summary: 'Get event registrations of current Telegram user' })
  getMyRegistrations(
    @Headers('x-telegram-init-data') initData?: string,
    @Query('tgUserId') fallbackId?: string,
  ) {
    const telegramId = this.resolveTelegramId(initData, fallbackId);
    return this.botUserService.getMyRegistrations(telegramId);
  }

  @Delete('registrations/:id')
  @ApiSecurity('telegram')
  @ApiOperation({ summary: 'Cancel event registration' })
  cancelRegistration(
    @Param('id') registrationId: string,
    @Headers('x-telegram-init-data') initData?: string,
    @Query('tgUserId') fallbackId?: string,
  ) {
    const telegramId = this.resolveTelegramId(initData, fallbackId);
    return this.botUserService.cancelRegistration(registrationId, telegramId);
  }

  @Get('stats')
  @Admin()
  @ApiOperation({ summary: 'Get total and active bot user count (admin)' })
  getStats() {
    return this.botUserService.getStats();
  }
}
