import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
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
import {
  DepartmentChat,
  matchDepartments,
  messageTopicId,
} from './department-chats';

const DEPARTMENT_CHATS_TTL_MS = 60_000;

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
  private syncInitialTimeout?: NodeJS.Timeout;
  private syncInterval?: NodeJS.Timeout;

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

    this.registerProjectChatHarvesting(this.bot);

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

    this.bot.catch((err) => {
      this.logger.error(
        'Failed to handle Telegram update: ' +
          (err.error instanceof Error ? err.error.message : String(err.error)),
      );
    });

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

    // Schedule initial and recurring membership sync (clean up members who left/were kicked)
    this.syncInitialTimeout = setTimeout(() => {
      this.syncDepartmentChatMembers().catch((err) =>
        this.logger.warn(
          'Initial chat members sync failed: ' +
            (err instanceof Error ? err.message : String(err)),
        ),
      );
    }, 60_000);
    this.syncInitialTimeout?.unref?.();

    this.syncInterval = setInterval(
      () => {
        this.syncDepartmentChatMembers().catch((err) =>
          this.logger.warn(
            'Scheduled chat members sync failed: ' +
              (err instanceof Error ? err.message : String(err)),
          ),
        );
      },
      12 * 60 * 60_000,
    );
    this.syncInterval?.unref?.();
  }

  // ---- Project-chat participant harvesting ("Люди проєктного") ------------

  // Department chat ids are configured in the admin panel (Department.telegramChatId),
  // so the mapping is read from the DB with a short cache instead of env vars.
  private deptChats: DepartmentChat[] = [];
  private deptNames = new Map<string, string>();
  private deptChatsLoadedAt = 0;
  private deptChatsVersion = 0;

  invalidateDepartmentChats() {
    this.deptChatsVersion += 1;
    this.deptChatsLoadedAt = 0;
  }

  private async departmentsFor(
    chatId: number,
    topicId: number | undefined,
    isJoin: boolean,
  ): Promise<string[]> {
    if (Date.now() - this.deptChatsLoadedAt > DEPARTMENT_CHATS_TTL_MS) {
      const version = this.deptChatsVersion;
      const rows = await this.prisma.department.findMany({
        where: { telegramChatId: { not: null } },
        select: { id: true, name: true, telegramChatId: true },
      });
      this.deptChats = rows.flatMap((r) => {
        const ref = parseChatRef(r.telegramChatId ?? undefined);
        return ref?.chatId
          ? [{ departmentId: r.id, chatId: ref.chatId, topicId: ref.threadId }]
          : [];
      });
      this.deptNames = new Map(rows.map((r) => [r.id, r.name]));
      if (version === this.deptChatsVersion) {
        this.deptChatsLoadedAt = Date.now();
      }
    }
    return matchDepartments(this.deptChats, chatId, topicId, isJoin);
  }

  private async moveDepartmentChats(fromChatId: number, toChatId: number) {
    const from = String(fromChatId);
    try {
      const rows = await this.prisma.department.findMany({
        where: {
          OR: [
            { telegramChatId: from },
            { telegramChatId: { startsWith: `${from}/` } },
          ],
        },
        select: { id: true, name: true, telegramChatId: true },
      });
      for (const row of rows) {
        const topic = (row.telegramChatId ?? '').slice(from.length);
        await this.prisma.department.update({
          where: { id: row.id },
          data: { telegramChatId: `${toChatId}${topic}` },
        });
        this.logger.log(
          `Telegram group ${from} became ${toChatId}; updated the chat ID of "${row.name}"`,
        );
      }
      if (rows.length > 0) this.invalidateDepartmentChats();
      for (const key of ['ADMIN_GROUP_CHAT_ID', 'PARTNERSHIP_CHAT_ID']) {
        if (
          parseChatRef(this.configService.get<string>(key))?.chatId === from
        ) {
          this.logger.warn(
            `${key} still points to the old group ${from}; set it to ${toChatId} in .env`,
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        'Failed to update department chats after a group upgrade: ' +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  }

  private registerProjectChatHarvesting(bot: Bot) {
    bot.on('message', async (ctx, next) => {
      if (ctx.chat.type !== 'private') {
        const {
          migrate_to_chat_id: movedTo,
          migrate_from_chat_id: movedFrom,
          sender_chat: senderChat,
          left_chat_member: leftMember,
        } = ctx.message;
        if (movedTo !== undefined) {
          await this.moveDepartmentChats(ctx.chat.id, movedTo);
        }
        if (movedFrom !== undefined) {
          await this.moveDepartmentChats(movedFrom, ctx.chat.id);
        }
        // If a member left or was removed via a service message
        if (leftMember && !leftMember.is_bot) {
          const departments = await this.departmentsFor(
            ctx.chat.id,
            undefined,
            false,
          );
          for (const departmentId of departments) {
            await this.removeUser(leftMember.id, departmentId);
          }
        }

        const joinedSelf = (ctx.message.new_chat_members ?? []).some(
          (m) => m.id === ctx.from?.id,
        );
        const sender =
          senderChat || leftMember || joinedSelf ? undefined : ctx.from;
        if (sender) {
          const topicId = messageTopicId(ctx.message, ctx.chat);
          const departments = await this.departmentsFor(
            ctx.chat.id,
            topicId,
            false,
          );
          for (const departmentId of departments) {
            await this.harvestUser(sender, departmentId);
          }
        }
        const joined = ctx.message.new_chat_members ?? [];
        if (joined.length > 0) {
          const departments = await this.departmentsFor(
            ctx.chat.id,
            undefined,
            true,
          );
          for (const departmentId of departments) {
            for (const member of joined) {
              await this.harvestUser(member, departmentId);
            }
          }
        }
      }
      await next();
    });

    bot.on('chat_member', async (ctx, next) => {
      const member = ctx.chatMember.new_chat_member;
      const present =
        member.status === 'member' ||
        member.status === 'administrator' ||
        member.status === 'creator' ||
        (member.status === 'restricted' && member.is_member);
      if (present) {
        const departments = await this.departmentsFor(
          ctx.chatMember.chat.id,
          undefined,
          true,
        );
        for (const departmentId of departments) {
          await this.harvestUser(member.user, departmentId);
        }
      } else if (member.status === 'left' || member.status === 'kicked') {
        const departments = await this.departmentsFor(
          ctx.chatMember.chat.id,
          undefined,
          false,
        );
        for (const departmentId of departments) {
          await this.removeUser(member.user.id, departmentId);
        }
      }
      await next();
    });
  }

  private async harvestUser(user: User, departmentId: string) {
    if (user.is_bot) return;
    try {
      const { id, isNew, needsAvatar } =
        await this.projectParticipants.upsertFromTelegram(
          {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            username: user.username,
          },
          departmentId,
        );
      if (isNew) {
        this.logger.log(
          `Added Telegram user ${user.id} to the people of "${this.deptNames.get(departmentId) ?? departmentId}"`,
        );
      }
      // Fetch the avatar only for newly-seen participants to avoid a
      // getUserProfilePhotos call on every message in a busy chat. A refresh
      // can be triggered manually from the admin later.
      if (needsAvatar) {
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

  /**
   * Handle user departure (left or kicked) from a department chat.
   */
  async removeUser(userId: number, departmentId: string): Promise<void> {
    try {
      const res = await this.projectParticipants.removeOrHideFromTelegram(
        departmentId,
        BigInt(userId),
      );
      if (res.action === 'deleted') {
        this.logger.log(
          `Removed departed user ${userId} from department "${this.deptNames.get(departmentId) ?? departmentId}"`,
        );
      } else if (res.action === 'hidden') {
        this.logger.log(
          `Hid departed manual participant ${userId} from department "${this.deptNames.get(departmentId) ?? departmentId}"`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Failed to handle departure of user ${userId} from department ${departmentId}: ` +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  }

  // ---- Membership + notifications ----------------------------------------

  async checkMemberStatus(
    chatId: string | number,
    userId: number,
  ): Promise<'member' | 'left' | 'error'> {
    if (!this.bot) return 'error';
    try {
      const member = await this.bot.api.getChatMember(chatId, userId);
      const isMember =
        member.status === 'creator' ||
        member.status === 'administrator' ||
        member.status === 'member' ||
        (member.status === 'restricted' && member.is_member);
      return isMember ? 'member' : 'left';
    } catch (err) {
      if (err instanceof GrammyError) {
        if (
          err.error_code === 400 ||
          err.description?.toLowerCase().includes('user not found') ||
          err.description?.toLowerCase().includes('participant')
        ) {
          return 'left';
        }
      }
      this.logger.warn(
        `Failed to check member status for user ${userId} in chat ${chatId}: ` +
          (err instanceof Error ? err.message : String(err)),
      );
      return 'error';
    }
  }

  /**
   * Scan department chat participants against Telegram's getChatMember to remove
   * people who left or were kicked from the group.
   */
  async syncDepartmentChatMembers(departmentId?: string): Promise<{
    checked: number;
    removed: number;
    hidden: number;
    errors: number;
  }> {
    const result = { checked: 0, removed: 0, hidden: 0, errors: 0 };
    if (!this.bot) {
      this.logger.warn('Bot is not configured — skipping chat members sync.');
      return result;
    }

    try {
      const departments = await this.prisma.department.findMany({
        where: {
          telegramChatId: { not: null },
          ...(departmentId ? { id: departmentId } : {}),
        },
        select: { id: true, name: true, telegramChatId: true },
      });

      for (const dept of departments) {
        const ref = parseChatRef(dept.telegramChatId ?? undefined);
        if (!ref?.chatId) continue;

        const participants = await this.projectParticipants.findWithTelegramId(
          dept.id,
        );

        for (const participant of participants) {
          if (!participant.telegramId) continue;
          const userId = Number(participant.telegramId);

          const status = await this.checkMemberStatus(ref.chatId, userId);
          result.checked++;

          if (status === 'left') {
            const res = await this.projectParticipants.removeOrHideFromTelegram(
              dept.id,
              participant.telegramId,
            );
            if (res.action === 'deleted') {
              result.removed++;
              this.logger.log(
                `Sync: removed departed user ${userId} (${participant.fullName}) from "${dept.name}"`,
              );
            } else if (res.action === 'hidden') {
              result.hidden++;
              this.logger.log(
                `Sync: hid departed manual participant ${userId} (${participant.fullName}) from "${dept.name}"`,
              );
            }
          } else if (status === 'error') {
            result.errors++;
          }

          // Small delay to respect Telegram rate limits
          await new Promise((r) => setTimeout(r, 50));
        }
      }
    } catch (err) {
      this.logger.error(
        'Failed to sync department chat members: ' +
          (err instanceof Error ? err.message : String(err)),
      );
    }

    return result;
  }

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
        throw new BadRequestException(
          `Телеграм відхилив пост: ${err.description}`,
        );
      }
      throw err;
    }
  }

  private resolvePhoto(photoUrl: string): string | InputFile {
    if (/^https?:\/\//i.test(photoUrl)) return photoUrl;
    // Locally-stored upload path like "/uploads/<file>": send the bytes
    // directly so Telegram doesn't need to reach our (possibly private) host.
    // Strictly isolate to filename within UPLOAD_DIR to prevent directory traversal.
    const clean = photoUrl.replace(/^\/?uploads\//, '');
    const filename = basename(clean);
    return new InputFile(resolve(UPLOAD_DIR, filename));
  }

  async onModuleDestroy() {
    if (this.syncInitialTimeout) clearTimeout(this.syncInitialTimeout);
    if (this.syncInterval) clearInterval(this.syncInterval);

    if (!this.bot) {
      return;
    }

    this.logger.log('Stopping Telegram Bot...');
    await this.bot.stop();
  }
}
