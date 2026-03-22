import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly bot: Bot;
  private readonly logger = new Logger(BotService.name);

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');

    if (!token) {
      throw new Error(
        'TELEGRAM_BOT_TOKEN was not found in the environment variables.',
      );
    }

    this.bot = new Bot(token);
  }

  onModuleInit() {
    this.logger.log('Initializing Telegram Bot...');

    const miniAppUrl = this.configService.get<string>('MINI_APP_URL');

    this.bot.command('start', (ctx) =>
      ctx.reply('Welcome! Open the admin panel below.', {
        reply_markup: miniAppUrl
          ? {
              inline_keyboard: [
                [
                  { 
                    text: 'Open Admin', 
                    web_app: { 
                      url: miniAppUrl 
                    } 
                  }
                ],
              ],
            }
          : undefined,
      }),
    );

    this.bot
      .start({
        onStart: (botInfo) => {
          this.logger.log(`Bot started successfully as @${botInfo.username}`);
        },
      })
      .catch((err) => {
        this.logger.error('Error during bot long polling', err);
      });
  }

  async onModuleDestroy() {
    this.logger.log('Stopping Telegram Bot...');
    await this.bot.stop();
  }
}
