import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  BadRequestException,
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, GrammyError, InputFile } from 'grammy';
import type { User } from 'grammy/types';
import { UPLOAD_DIR, UPLOAD_URL_PREFIX } from '../upload/upload.constants';
import { PrismaService } from '../database/prisma.service';
import { ProjectParticipantService } from '../modules/project_participant/project_participant.service';

export interface ChannelPostOptions {
  text: string;
  photoUrl?: string;
  button?: { text: string; url: string };
}

/**
 * Parse a chat reference that may point at a forum topic: "-100123" or, for a
 * topic (гілка), "-100123/12" (chatId/threadId).
 */
export function parseChatRef(
  value?: string,
): { chatId: string; threadId?: number } | undefined {
  if (!value) return undefined;
  const [chatId, thread] = value.split('/');
  const threadId = thread ? Number(thread) : undefined;
  return {
    chatId: chatId.trim(),
    threadId: Number.isFinite(threadId) ? threadId : undefined,
  };
}

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly bot?: Bot;
  private readonly logger = new Logger(BotService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly projectParticipants: ProjectParticipantService,
  ) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.bot = token ? new Bot(token) : undefined;
  }

  onModuleInit() {
    if (!this.bot) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN is not set. Telegram bot startup is skipped.',
      );
      return;
    }

    this.logger.log('Initializing Telegram Bot...');

    const miniAppUrl = this.configService.get<string>('MINI_APP_URL');

    this.bot.command('start', async (ctx) => {
      // `web_app` buttons are only valid in private chats — Telegram rejects
      // them elsewhere with BUTTON_TYPE_INVALID, which would crash the poller.
      const useWebApp = !!miniAppUrl && ctx.chat?.type === 'private';
      try {
        await ctx.reply(
          useWebApp
            ? 'Welcome! Open the admin panel below.'
            : 'Відкрий адмін-панель у приватному чаті зі мною.',
          useWebApp
            ? {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: 'Open Admin', web_app: { url: miniAppUrl } }],
                  ],
                },
              }
            : undefined,
        );
      } catch (err) {
        this.logger.warn(
          'Failed to reply to /start: ' +
            (err instanceof Error ? err.message : String(err)),
        );
      }
    });

    this.registerProjectChatHarvesting(this.bot);

    this.bot
      .start({
        // Opt into member join/leave updates so we can harvest new members of
        // the project chat, not only those who send a message. `chat_member`
        // is only delivered when the bot is an administrator of the chat.
        allowed_updates: [
          'message',
          'edited_message',
          'chat_member',
          'my_chat_member',
        ],
        onStart: (botInfo) => {
          this.logger.log(`Bot started successfully as @${botInfo.username}`);
        },
      })
      .catch((err) => {
        this.logger.error('Error during bot long polling', err);
      });
  }

  // ---- Project-chat participant harvesting ("Люди проєктного") ------------

  // Department chat ids are configured in the admin panel (Department.telegramChatId),
  // so the mapping is read from the DB with a short cache instead of env vars.
  private deptChats: { id: string; chatId: string; threadId?: number }[] = [];
  private deptChatsLoadedAt = 0;

  private async departmentForChat(
    chatId: number,
    threadId?: number,
    requireNoThread = false,
  ): Promise<string | undefined> {
    if (Date.now() - this.deptChatsLoadedAt > 60_000) {
      const rows = await this.prisma.department.findMany({
        where: { telegramChatId: { not: null } },
        select: { id: true, telegramChatId: true },
      });
      this.deptChats = rows.flatMap((r) => {
        const ref = parseChatRef(r.telegramChatId ?? undefined);
        return ref ? [{ id: r.id, ...ref }] : [];
      });
      this.deptChatsLoadedAt = Date.now();
    }
    const match = this.deptChats.find((d) => d.chatId === String(chatId));
    if (!match) return undefined;
    if (match.threadId !== undefined) {
      // Topic-scoped chat: joins aren't topic-scoped, so skip them entirely,
      // and only count messages posted in that topic.
      if (requireNoThread || threadId !== match.threadId) return undefined;
    }
    return match.id;
  }

  private registerProjectChatHarvesting(bot: Bot) {
    // Anyone who writes in a department chat (or its configured topic/гілка).
    bot.on('message', async (ctx) => {
      if (!ctx.chat || ctx.chat.type === 'private' || !ctx.from) return;
      const deptId = await this.departmentForChat(
        ctx.chat.id,
        ctx.message.message_thread_id,
      );
      if (deptId) await this.harvestUser(ctx.from, deptId);
    });

    // People added to a department chat (may never send a message).
    bot.on('message:new_chat_members', async (ctx) => {
      const deptId = await this.departmentForChat(ctx.chat.id, undefined, true);
      if (!deptId) return;
      for (const member of ctx.message.new_chat_members) {
        await this.harvestUser(member, deptId);
      }
    });

    bot.on('chat_member', async (ctx) => {
      const deptId = await this.departmentForChat(
        ctx.chatMember.chat.id,
        undefined,
        true,
      );
      if (!deptId) return;
      const status = ctx.chatMember.new_chat_member.status;
      if (status === 'member' || status === 'administrator') {
        await this.harvestUser(ctx.chatMember.new_chat_member.user, deptId);
      }
    });
  }

  private async harvestUser(user: User, departmentId: string) {
    if (user.is_bot) return;
    try {
      const { id, created } = await this.projectParticipants.upsertFromTelegram(
        {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          username: user.username,
        },
        departmentId,
      );
      // Fetch the avatar only for newly-seen participants to avoid a
      // getUserProfilePhotos call on every message in a busy chat. A refresh
      // can be triggered manually from the admin later.
      if (created) {
        const avatar = await this.fetchAndStoreAvatar(user.id);
        if (avatar) {
          await this.projectParticipants.setAvatar(
            id,
            avatar.photo,
            avatar.fileId,
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        'Failed to harvest project participant: ' +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  }

  private async fetchAndStoreAvatar(
    userId: number,
  ): Promise<{ photo: string; fileId: string } | null> {
    if (!this.bot) return null;
    try {
      const photos = await this.bot.api.getUserProfilePhotos(userId, {
        limit: 1,
      });
      const sizes = photos.photos[0];
      if (!sizes || sizes.length === 0) return null;
      const largest = sizes[sizes.length - 1];
      const file = await this.bot.api.getFile(largest.file_id);
      if (!file.file_path) return null;

      const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
      const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
      const res = await fetch(url);
      if (!res.ok) return null;

      const buffer = Buffer.from(await res.arrayBuffer());
      const filename = `${randomUUID()}.jpg`;
      await writeFile(resolve(UPLOAD_DIR, filename), buffer);
      return {
        photo: `${UPLOAD_URL_PREFIX}/${filename}`,
        fileId: largest.file_unique_id,
      };
    } catch (err) {
      this.logger.warn(
        'Failed to download Telegram avatar: ' +
          (err instanceof Error ? err.message : String(err)),
      );
      return null;
    }
  }

  // ---- Membership + notifications ----------------------------------------

  async isUserInChat(
    chatId: string | number,
    userId: number,
  ): Promise<boolean> {
    if (!this.bot) {
      this.logger.warn('Cannot check chat membership: bot is not configured.');
      return false;
    }
    try {
      const member = await this.bot.api.getChatMember(chatId, userId);
      const isMember =
        member.status === 'creator' ||
        member.status === 'administrator' ||
        member.status === 'member';
      this.logger.log(
        `Membership check: user ${userId} in chat ${chatId} -> status="${member.status}" (allowed=${isMember})`,
      );
      return isMember;
    } catch (err) {
      this.logger.warn(
        `Failed to check membership of user ${userId} in chat ${chatId}: ` +
          (err instanceof Error ? err.message : String(err)),
      );
      return false;
    }
  }

  async notifyGroup(text: string): Promise<void> {
    const chatId = this.configService.get<string>('ADMIN_GROUP_CHAT_ID');
    if (!chatId) {
      this.logger.warn(
        'ADMIN_GROUP_CHAT_ID is not set — skipping notification.',
      );
      return;
    }
    await this.sendToChat(chatId, text);
  }

  /**
   * Send a plain-text message to a chat, optionally into a forum topic
   * (best-effort, never throws).
   */
  async sendToChat(
    chatId: string | number,
    text: string,
    threadId?: number,
  ): Promise<void> {
    if (!this.bot) {
      this.logger.warn('Cannot send message: bot is not configured.');
      return;
    }
    try {
      await this.bot.api.sendMessage(
        chatId,
        text,
        threadId !== undefined ? { message_thread_id: threadId } : undefined,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to send message to chat ${chatId}: ` +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  }

  // ---- Channel publishing (announcement + register button) ---------------

  /**
   * Publish a post to the configured Telegram channel. Unlike notifications
   * this throws when it can't post, so the admin gets a clear error.
   */
  async postToChannel(
    options: ChannelPostOptions,
  ): Promise<{ messageId: number }> {
    const chatId = this.configService.get<string>('TELEGRAM_CHANNEL_ID');
    if (!this.bot || !chatId) {
      throw new ServiceUnavailableException(
        'Телеграм-канал не налаштований (TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID).',
      );
    }

    const reply_markup = options.button
      ? {
          inline_keyboard: [
            [{ text: options.button.text, url: options.button.url }],
          ],
        }
      : undefined;

    // parse_mode HTML lets the composer use <b>, <u>, <a href="…">.
    try {
      // Photo captions are limited to 1024 chars; longer posts go out as text.
      if (options.photoUrl && options.text.length <= 1024) {
        const msg = await this.bot.api.sendPhoto(
          chatId,
          this.resolvePhoto(options.photoUrl),
          { caption: options.text, parse_mode: 'HTML', reply_markup },
        );
        return { messageId: msg.message_id };
      }

      const msg = await this.bot.api.sendMessage(chatId, options.text, {
        parse_mode: 'HTML',
        reply_markup,
      });
      return { messageId: msg.message_id };
    } catch (err) {
      if (err instanceof GrammyError) {
        throw new BadRequestException(`Телеграм відхилив пост: ${err.description}`);
      }
      throw err;
    }
  }

  private resolvePhoto(photoUrl: string): string | InputFile {
    if (/^https?:\/\//i.test(photoUrl)) return photoUrl;
    // Locally-stored upload path like "/uploads/<file>": send the bytes
    // directly so Telegram doesn't need to reach our (possibly private) host.
    const filename = photoUrl.replace(/^\/?uploads\//, '');
    return new InputFile(resolve(UPLOAD_DIR, filename));
  }

  async onModuleDestroy() {
    if (!this.bot) {
      return;
    }

    this.logger.log('Stopping Telegram Bot...');
    await this.bot.stop();
  }
}
