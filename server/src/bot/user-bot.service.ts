import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, GrammyError, InputFile } from 'grammy';
import { resolve } from 'node:path';
import { PrismaService } from '../database/prisma.service';
import { UPLOAD_DIR } from '../upload/upload.constants';

export interface BroadcastPayload {
  text: string;
  imageUrl?: string;
  button?: {
    text: string;
    url?: string;
    isWebApp?: boolean;
  };
}

@Injectable()
export class UserBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UserBotService.name);
  private bot?: Bot;
  private botUsername?: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const token =
      this.configService.get<string>('USER_BOT_TOKEN') ||
      this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (token) {
      this.bot = new Bot(token);
    }
  }

  getUsername(): string | undefined {
    return (
      this.configService.get<string>('USER_BOT_USERNAME') || this.botUsername
    );
  }

  getMiniAppUrl(): string {
    const userUrl = this.configService.get<string>('USER_MINI_APP_URL');
    if (userUrl) return userUrl.replace(/\/$/, '');

    const miniAppUrl = this.configService.get<string>('MINI_APP_URL');
    if (miniAppUrl) return `${miniAppUrl.replace(/\/$/, '')}/app`;

    const webUrl = this.configService.get<string>('PUBLIC_WEB_URL');
    if (webUrl) return `${webUrl.replace(/\/$/, '')}/app`;

    return 'https://localhost:3000/app';
  }

  onModuleInit() {
    if (!this.bot) {
      this.logger.warn(
        'USER_BOT_TOKEN is not configured. User Telegram bot startup is skipped.',
      );
      return;
    }

    const userToken = this.configService.get<string>('USER_BOT_TOKEN');
    const adminToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');

    if (adminToken && (!userToken || userToken === adminToken)) {
      this.logger.warn(
        'USER_BOT_TOKEN is not set or equals TELEGRAM_BOT_TOKEN. Skipping secondary polling.',
      );
      return;
    }

    this.logger.log('Initializing User Telegram Bot...');

    this.bot.command('start', async (ctx) => {
      const from = ctx.from;
      if (!from || from.is_bot) return;

      const telegramId = BigInt(from.id);
      const chatId = BigInt(ctx.chat.id);

      try {
        await this.prisma.botUser.upsert({
          where: { telegramId },
          create: {
            telegramId,
            chatId,
            username: from.username ?? null,
            firstName: from.first_name ?? null,
            lastName: from.last_name ?? null,
            isBlocked: false,
          },
          update: {
            chatId,
            username: from.username ?? null,
            firstName: from.first_name ?? null,
            lastName: from.last_name ?? null,
            isBlocked: false,
          },
        });
      } catch (err) {
        this.logger.error('Failed to upsert BotUser on /start', err);
      }

      const match = ctx.match?.trim() ?? '';
      const baseAppUrl = this.getMiniAppUrl();

      let targetAppUrl = baseAppUrl;
      let buttonText = 'Відкрити афішу FICE';
      let greeting =
        `Привіт, ${from.first_name || 'друже'}!\n\n` +
        'Це офіційний бот подій та активностей FICE. ' +
        'Тут ти можеш реєструватися на заходи факультету, переглядати актуальну афішу, свої реєстрації та брати участь у голосуваннях!';

      if (match.startsWith('reg_')) {
        const token = match.replace('reg_', '').trim();
        try {
          const pending = await this.prisma.pendingWebRegistration.findUnique({
            where: { token },
            include: { event: true },
          });

          if (pending && !pending.completed && pending.expiresAt > new Date()) {
            const payload = pending.payload as any;
            const fromUsername = (from.username || '').trim().toLowerCase().replace(/^@+/, '');
            const pendingTag = pending.telegramTag.trim().toLowerCase().replace(/^@+/, '');

            // Cross-account spoofing prevention: verify current Telegram user matches the tag in the form
            if (!fromUsername || fromUsername !== pendingTag) {
              await ctx.reply(
                `⚠️ Помилка авторизації реєстрації.\n\nУ формі на сайті було вказано Telegram-тег @${pendingTag}, але ви відкрили бота з облікового запису ${fromUsername ? '@' + fromUsername : 'без username'}.\n\nБудь ласка, відкрийте посилання з акаунту @${pendingTag} або заповніть форму заново зі своїм дійсним тегом.`,
              );
              return;
            }

            const cleanTag = fromUsername;
            const normalizedTag = `@${cleanTag}`;

            // Check if already registered
            const existingReg = await this.prisma.eventRegistration.findFirst({
              where: {
                eventId: pending.eventId,
                OR: [
                  { telegramUserId: telegramId },
                  { telegramTag: { equals: normalizedTag, mode: 'insensitive' } },
                ],
              },
            });

            if (existingReg) {
              await this.prisma.pendingWebRegistration.update({
                where: { token },
                data: { completed: true },
              });
              await ctx.reply(
                `ℹ️ Ви вже зареєстровані на захід «${pending.event.name}»!\n\nСторінка на сайті вже оновилася.`,
                {
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: 'Мої реєстрації в боті', web_app: { url: `${baseAppUrl}?tab=my-events` } }],
                    ],
                  },
                },
              );
              return;
            }

            const questions = await this.prisma.eventQuestion.findMany({
              where: { eventId: pending.eventId },
            });
            const validIds = new Set(questions.map((q) => q.id));
            const answerData = ((payload.answers as any[]) ?? [])
              .filter((a) => validIds.has(a.questionId) && (a.value ?? '').length > 0)
              .map((a) => ({ questionId: a.questionId, value: a.value }));

            const botUser = await this.prisma.botUser.upsert({
              where: { telegramId },
              create: {
                telegramId,
                chatId,
                username: cleanTag || null,
                firstName: from.first_name || null,
                lastName: from.last_name || null,
                fullName: payload.fullName || null,
                group: payload.group || null,
                birthDate: payload.birthDate ? new Date(payload.birthDate) : null,
                phoneNumber: payload.phoneNumber || null,
                isBlocked: false,
              },
              update: {
                chatId,
                username: cleanTag || undefined,
                firstName: from.first_name || undefined,
                lastName: from.last_name || undefined,
              },
            });

            await this.prisma.eventRegistration.create({
              data: {
                eventId: pending.eventId,
                botUserId: botUser.id,
                telegramUserId: telegramId,
                fullName: payload.fullName,
                telegramTag: normalizedTag,
                group: payload.group,
                birthDate: payload.birthDate ? new Date(payload.birthDate) : null,
                payment: payload.payment ?? 'NONE',
                receiptUrl: payload.receiptUrl ?? null,
                answers: answerData.length ? { create: answerData } : undefined,
              },
            });

            await this.prisma.pendingWebRegistration.update({
              where: { token },
              data: { completed: true },
            });

            await ctx.reply(
              `🎉 Чудово, ${from.first_name || 'друже'}! Твою реєстрацію на захід «${pending.event.name}» успішно підтверджено!\n\nСторінка на сайті вже оновилася. Побачимось на заході!`,
              {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: 'Мої реєстрації в боті', web_app: { url: `${baseAppUrl}?tab=my-events` } }],
                  ],
                },
              },
            );
            return;
          }
        } catch (regErr) {
          this.logger.error('Failed to complete pending web registration on /start', regErr);
        }
      } else if (match.startsWith('event_')) {
        const eventId = match.replace('event_', '');
        targetAppUrl = `${baseAppUrl}?startapp=event_${eventId}`;
        buttonText = 'Зареєструватися на захід';
        greeting += '\n\nНатисни кнопку нижче, щоб відкрити реєстрацію на обраний захід:';
      } else if (match.startsWith('vote_')) {
        const votingId = match.replace('vote_', '');
        targetAppUrl = `${baseAppUrl}?startapp=vote_${votingId}`;
        buttonText = 'Відкрити голосування';
        greeting += '\n\nНатисни кнопку нижче, щоб перейти до голосування:';
      }

      try {
        await ctx.reply(greeting, {
          reply_markup: {
            inline_keyboard: [
              [{ text: buttonText, web_app: { url: targetAppUrl } }],
            ],
          },
        });
      } catch (err) {
        this.logger.warn(
          'Failed to send /start reply: ' +
            (err instanceof Error ? err.message : String(err)),
        );
      }
    });

    this.bot.on('my_chat_member', async (ctx) => {
      const status = ctx.myChatMember.new_chat_member.status;
      const telegramId = BigInt(ctx.myChatMember.from.id);
      const isBlocked = status === 'kicked';

      try {
        await this.prisma.botUser.updateMany({
          where: { telegramId },
          data: { isBlocked },
        });
      } catch (err) {
        this.logger.warn('Failed to update bot user block status', err);
      }
    });

    this.bot
      .start({
        allowed_updates: ['message', 'my_chat_member'],
        onStart: async (botInfo) => {
          this.botUsername = botInfo.username;
          this.logger.log(`User Bot started successfully as @${botInfo.username}`);

          try {
            await this.bot?.api.setChatMenuButton({
              menu_button: {
                type: 'web_app',
                text: 'Заходи FICE',
                web_app: { url: this.getMiniAppUrl() },
              },
            });
          } catch (e) {
            this.logger.warn('Failed to set chat menu button for user bot: ' + e);
          }
        },
      })
      .catch((err) => {
        this.logger.error('Error during User Bot long polling', err);
      });
  }

  async sendBroadcast(
    recipients: { chatId: bigint; telegramId?: bigint }[],
    payload: BroadcastPayload,
  ): Promise<{ sent: number; failed: number }> {
    if (!this.bot) {
      this.logger.warn('User bot is not configured — broadcast skipped');
      return { sent: 0, failed: recipients.length };
    }

    let sent = 0;
    let failed = 0;

    let finalBtnUrl = payload.button?.url?.trim();
    let isWebApp = Boolean(payload.button?.isWebApp);

    if (finalBtnUrl) {
      const baseAppUrl = this.getMiniAppUrl();

      // Check if URL is meant for the Telegram Mini App
      const isMiniAppTarget =
        isWebApp ||
        finalBtnUrl.includes('startapp=') ||
        finalBtnUrl.includes('start=event_') ||
        finalBtnUrl.includes('start=vote_') ||
        finalBtnUrl.includes('/app?') ||
        finalBtnUrl.endsWith('/app') ||
        (finalBtnUrl.includes('t.me/') &&
          (finalBtnUrl.includes('/app') ||
            finalBtnUrl.includes('startapp=') ||
            finalBtnUrl.includes('start=')));

      if (isMiniAppTarget) {
        let query = '';
        try {
          if (finalBtnUrl.includes('?')) {
            const searchPart = finalBtnUrl.split('?')[1] || '';
            const searchParams = new URLSearchParams(searchPart);
            const startParam =
              searchParams.get('startapp') ||
              searchParams.get('start') ||
              searchParams.get('tgWebAppStartParam');
            if (startParam) {
              query = `?startapp=${encodeURIComponent(startParam)}`;
            } else if (searchPart) {
              query = `?${searchPart}`;
            }
          }
        } catch {
          // ignore error
        }

        if (
          finalBtnUrl.startsWith('https://t.me/') ||
          finalBtnUrl.startsWith('tg://') ||
          finalBtnUrl.startsWith('/') ||
          !finalBtnUrl.startsWith('http')
        ) {
          finalBtnUrl = `${baseAppUrl}${query}`;
          isWebApp = true;
        } else if (finalBtnUrl.startsWith('https://')) {
          isWebApp = true;
        }
      }
    }

    const reply_markup =
      payload.button?.text && finalBtnUrl
        ? {
            inline_keyboard: [
              isWebApp && finalBtnUrl.startsWith('https://')
                ? [{ text: payload.button.text, web_app: { url: finalBtnUrl } }]
                : [{ text: payload.button.text, url: finalBtnUrl }],
            ],
          }
        : undefined;

    const resolvePhoto = (photoUrl: string): string | InputFile => {
      if (/^https?:\/\//i.test(photoUrl)) return photoUrl;
      const filename = photoUrl.replace(/^\/?uploads\//, '');
      return new InputFile(resolve(UPLOAD_DIR, filename));
    };

    for (const recipient of recipients) {
      const chatIdNumber = Number(recipient.chatId);
      try {
        if (payload.imageUrl && payload.text.length <= 1024) {
          await this.bot.api.sendPhoto(
            chatIdNumber,
            resolvePhoto(payload.imageUrl),
            {
              caption: payload.text,
              parse_mode: 'HTML',
              reply_markup,
            },
          );
        } else {
          await this.bot.api.sendMessage(chatIdNumber, payload.text, {
            parse_mode: 'HTML',
            reply_markup,
          });
        }
        sent++;
      } catch (err) {
        failed++;
        if (err instanceof GrammyError && (err.error_code === 403 || err.description.includes('bot was blocked'))) {
          if (recipient.telegramId) {
            await this.prisma.botUser.updateMany({
              where: { telegramId: recipient.telegramId },
              data: { isBlocked: true },
            }).catch(() => {});
          }
        }
        this.logger.warn(`Failed to send broadcast to ${chatIdNumber}: ${err}`);
      }

      await new Promise((r) => setTimeout(r, 40));
    }

    return { sent, failed };
  }

  async sendMessageToUser(
    chatId: bigint | number,
    text: string,
    button?: { text: string; url: string; isWebApp?: boolean },
  ): Promise<boolean> {
    if (!this.bot) return false;
    const chatIdNum = Number(chatId);

    let reply_markup: any = undefined;
    if (button?.text && button?.url) {
      const baseAppUrl = this.getMiniAppUrl();
      let targetUrl = button.url;
      let isWebApp = button.isWebApp ?? false;

      if (
        targetUrl.includes('startapp=') ||
        targetUrl.includes('/app') ||
        isWebApp
      ) {
        if (!targetUrl.startsWith('http')) {
          targetUrl = `${baseAppUrl}?${targetUrl.replace(/^\?/, '')}`;
        }
        isWebApp = true;
      }

      reply_markup = {
        inline_keyboard: [
          isWebApp && targetUrl.startsWith('https://')
            ? [{ text: button.text, web_app: { url: targetUrl } }]
            : [{ text: button.text, url: targetUrl }],
        ],
      };
    }

    try {
      await this.bot.api.sendMessage(chatIdNum, text, {
        parse_mode: 'HTML',
        reply_markup,
      });
      return true;
    } catch (err) {
      this.logger.warn(
        `Failed to send direct message to user ${chatIdNum}: ${err}`,
      );
      return false;
    }
  }

  async onModuleDestroy() {
    if (this.bot) {
      this.logger.log('Stopping User Telegram Bot...');
      await this.bot.stop();
    }
  }
}
