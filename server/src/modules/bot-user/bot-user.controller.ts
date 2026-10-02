import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Admin } from '../../auth/admin.decorator';
import { resolveValidatedTelegramUser } from '../../auth/init-data.util';
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
    return resolveValidatedTelegramUser(this.config, initData, {
      id: fallbackId,
    }).telegramId;
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
    @Param('id', ParseUUIDPipe) registrationId: string,
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
