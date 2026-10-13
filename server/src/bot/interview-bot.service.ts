import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { errorMessage } from '../common/log-safe';
import { PollingStatus, PollingSupervisor } from './polling';

/** Separate bot for booking council interviews; opens the /interview mini-app. */
@Injectable()
export class InterviewBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InterviewBotService.name);
  private readonly bot?: Bot;
  private polling?: PollingSupervisor;
  private username?: string;

  constructor(private readonly config: ConfigService) {
    const token = config.get<string>('INTERVIEW_BOT_TOKEN');
    this.bot = token ? new Bot(token) : undefined;
  }

  get enabled(): boolean {
    return !!this.bot;
  }

  getUsername(): string | undefined {
    return this.username;
  }

  miniAppUrl(): string | undefined {
    const web = this.config
      .get<string>('PUBLIC_WEB_URL')
      ?.trim()
      .replace(/\/$/, '');
    return web?.startsWith('https://') ? `${web}/interview` : undefined;
  }

  onModuleInit() {
    if (!this.bot) {
      this.logger.warn(
        'INTERVIEW_BOT_TOKEN is not set. Interview bot startup is skipped.',
      );
      return;
    }
    const url = this.miniAppUrl();
    if (!url) {
      this.logger.warn(
        'PUBLIC_WEB_URL is not an https URL — the interview bot cannot open its mini-app.',
      );
    }

    this.bot.command('start', async (ctx) => {
      if (ctx.chat.type !== 'private') return;
      try {
        await ctx.reply(
          'Привіт! Тут можна записатися на співбесіду до Студради ФІОТ. Натисни кнопку нижче 👇',
          url
            ? {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: 'Відкрити запис', web_app: { url } }],
                  ],
                },
              }
            : undefined,
        );
      } catch (err) {
        this.logger.warn('Failed to reply to /start: ' + errorMessage(err));
      }
    });

    this.bot.catch((err) => {
      this.logger.error(
        'Failed to handle Telegram update: ' + errorMessage(err.error),
      );
    });

    this.polling = new PollingSupervisor(this.bot, this.logger, {
      allowed_updates: ['message'],
      onStart: async (botInfo) => {
        this.username = botInfo.username;
        this.logger.log(`Interview bot started as @${botInfo.username}`);
        if (!url) return;
        try {
          await this.bot?.api.setChatMenuButton({
            menu_button: {
              type: 'web_app',
              text: 'Співбесіда',
              web_app: { url },
            },
          });
        } catch (err) {
          this.logger.warn(
            'Failed to set interview bot menu button: ' + errorMessage(err),
          );
        }
      },
    });
    this.polling.start();
  }

  /** Sends an HTML message to a private chat; false when it is not delivered. */
  async send(telegramId: bigint, html: string): Promise<boolean> {
    if (!this.bot) return false;
    try {
      await this.bot.api.sendMessage(Number(telegramId), html, {
        parse_mode: 'HTML',
      });
      return true;
    } catch (err) {
      this.logger.warn(`Failed to message ${telegramId}: ${errorMessage(err)}`);
      return false;
    }
  }

  pollingStatus(): PollingStatus {
    return this.polling?.getStatus() ?? 'disabled';
  }

  async onModuleDestroy() {
    await this.polling?.stop();
  }
}
