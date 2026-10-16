import { basename, resolve } from 'node:path';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelPost, News, NewsCategory } from '@prisma/client';
import { BotService, parseChatRef } from '../../bot/bot.service';
import { UserBotService } from '../../bot/user-bot.service';
import { errorMessage } from '../../common/log-safe';
import { PrismaService } from '../../database/prisma.service';
import {
  ADMIN_IMAGE_PROFILE,
  reencodeImage,
} from '../../upload/image-processing';
import { UPLOAD_DIR } from '../../upload/upload.constants';
import { CreateChannelPostDto } from './dto/create-channel-post.dto';
import { UpdateChannelPostDto } from './dto/update-channel-post.dto';
import {
  CAPTION_LIMIT,
  excerpt,
  formatKyiv,
  lengthProblem,
  MediaType,
  plainText,
  PostMedia,
} from './post-format';

const TICK_MS = 30_000;
const GONE = 'Цього поста вже немає в черзі';
export const HANDLED = 'Цей запит уже оброблено';

export type PostKind = 'channel' | 'site';

/** A link button, or the registration button of one of our events. */
export type ButtonChoice = { text: string; url: string } | { eventId: string };

export type QueueItem =
  | { kind: 'channel'; id: string; publishAt: Date; post: ChannelPost }
  | { kind: 'site'; id: string; publishAt: Date; news: News };

export interface PostChanges {
  publishAt?: Date;
  text?: string;
  title?: string;
  category?: NewsCategory | null;
  button?: ButtonChoice | null;
}

/**
 * Channel posts and scheduled site news ("Публікації"): the admin panel's
 * composer, the queue, and the scheduler that sends channel posts when due.
 * A scheduled site post is just a news item with a future publishDate.
 */
@Injectable()
export class ChannelService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChannelService.name);
  private timer?: NodeJS.Timeout;
  private ticking = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: BotService,
    private readonly userBot: UserBotService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.publishDue(), TICK_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  status() {
    const channelIdSet = !!this.config.get<string>('TELEGRAM_CHANNEL_ID');
    const botTokenSet = !!this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const webUrlSet = !!this.config.get<string>('PUBLIC_WEB_URL');
    const publicWebUrl = this.config.get<string>('PUBLIC_WEB_URL') || '';
    const botUsername = this.userBot.getUsername() ?? null;
    const appName = this.config.get<string>('USER_MINI_APP_NAME') || 'app';
    return {
      configured: channelIdSet && botTokenSet,
      channelIdSet,
      botTokenSet,
      webUrlSet,
      publicWebUrl,
      botUsername,
      appName,
    };
  }

  /** The admin panel composer: publishes now, or at publishAt when it is in the future. */
  async post(dto: CreateChannelPostDto, author?: string) {
    let photoUrl = dto.imageUrl;
    let button: { text: string; url: string } | undefined;

    if (dto.eventId) {
      const event = await this.prisma.event.findUnique({
        where: { id: dto.eventId },
        select: { id: true, photoUrl: true },
      });
      if (!event) {
        throw new NotFoundException(`Event ${dto.eventId} not found`);
      }
      // Fall back to the event cover if the composer didn't set an image and
      // the text fits a caption.
      if (!photoUrl && plainText(dto.text).length <= CAPTION_LIMIT) {
        photoUrl = event.photoUrl ?? undefined;
      }
    }

    if (dto.buttonUrl) {
      button = {
        text: dto.buttonText?.trim() || 'Перейти',
        url: dto.buttonUrl.trim(),
      };
    } else if (dto.eventId) {
      button = {
        text: dto.buttonText?.trim() || 'Зареєструватися',
        url: this.eventButtonUrl(dto.eventId),
      };
    }

    const problem = lengthProblem(dto.text, !!photoUrl);
    if (problem) throw new BadRequestException(problem);

    const now = new Date();
    const later = dto.publishAt && dto.publishAt > now ? dto.publishAt : null;
    const post = await this.prisma.channelPost.create({
      data: {
        text: dto.text,
        imageUrl: photoUrl ?? null,
        buttonText: button?.text ?? null,
        buttonUrl: button?.url ?? null,
        publishAt: later ?? now,
        author: author ?? null,
      },
    });
    if (later) return { ok: true, id: post.id, scheduled: true };
    return {
      ok: true,
      id: post.id,
      messageId: await this.publishOrDrop(post.id),
    };
  }

  eventButtonUrl(eventId: string): string {
    const botUsername = this.userBot.getUsername();
    if (botUsername) {
      const appName = this.config.get<string>('USER_MINI_APP_NAME') || 'app';
      return `https://t.me/${botUsername}/${appName}?startapp=event_${eventId}`;
    }
    const base = this.config.get<string>('PUBLIC_WEB_URL');
    if (!base) {
      throw new ServiceUnavailableException(
        'PUBLIC_WEB_URL не налаштовано — не можу зібрати посилання на реєстрацію.',
      );
    }
    return `${base.replace(/\/$/, '')}/events/${eventId}#register`;
  }

  /** Sends a post now. Null when it is already out (e.g. the scheduler got there first). */
  async publish(id: string): Promise<number | null> {
    const claimed = await this.prisma.channelPost.updateMany({
      where: { id, status: { not: 'PUBLISHED' } },
      data: { status: 'PUBLISHED', publishAt: new Date(), error: null },
    });
    if (!claimed.count) return null;
    const post = await this.prisma.channelPost.findUniqueOrThrow({
      where: { id },
    });
    try {
      const { messageId } = await this.bot.postToChannel({
        text: post.text,
        photoUrl: post.imageUrl ?? undefined,
        media: post.mediaFileId
          ? { type: post.mediaType as MediaType, fileId: post.mediaFileId }
          : undefined,
        button: post.buttonUrl
          ? { text: post.buttonText || 'Перейти', url: post.buttonUrl }
          : undefined,
      });
      await this.prisma.channelPost.update({
        where: { id },
        data: { messageId },
      });
      return messageId;
    } catch (err) {
      await this.prisma.channelPost.update({
        where: { id },
        data: { status: 'FAILED', error: errorMessage(err).slice(0, 500) },
      });
      throw err;
    }
  }

  /** "Publish now" right after composing: on failure the content is still at hand, so no queue entry. */
  async publishOrDrop(id: string): Promise<number | null> {
    try {
      return await this.publish(id);
    } catch (err) {
      await this.prisma.channelPost.delete({ where: { id } }).catch(() => {});
      throw err;
    }
  }

  async publishDue() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const due = await this.prisma.channelPost.findMany({
        where: { status: 'SCHEDULED', publishAt: { lte: new Date() } },
        orderBy: { publishAt: 'asc' },
        take: 20,
      });
      for (const post of due) {
        try {
          const messageId = await this.publish(post.id);
          if (messageId) {
            await this.report(
              post,
              `Запланований пост вийшов у каналі: ${this.postLink(messageId)}`,
            );
          }
        } catch (err) {
          await this.report(
            post,
            `Не вдалося опублікувати запланований пост «${excerpt(post.text)}»: ${errorMessage(err)}\n` +
              'Він лишився в черзі: /queue у чаті медіа або міні-апка → Публікації.',
            true,
          );
        }
      }
    } catch (err) {
      this.logger.warn('Scheduled channel posts failed: ' + errorMessage(err));
    } finally {
      this.ticking = false;
    }
  }

  /** Tells the media chat (under the source post) or, for admin panel posts, the admin group. */
  private async report(post: ChannelPost, text: string, failed = false) {
    const ref = parseChatRef(this.config.get<string>('MEDIA_POST_CHAT_ID'));
    const api = this.bot.telegram?.api;
    if (post.sourceMessageId && ref && api) {
      try {
        await api.sendMessage(ref.chatId, text, {
          message_thread_id: ref.threadId,
          reply_parameters: {
            message_id: post.sourceMessageId,
            allow_sending_without_reply: true,
          },
          link_preview_options: { is_disabled: true },
        });
      } catch (err) {
        this.logger.warn(
          'Failed to report a channel post: ' + errorMessage(err),
        );
      }
    } else if (failed) {
      await this.bot.notifyGroup(text);
    }
  }

  postLink(messageId: number): string {
    const channel =
      this.config.get<string>('TELEGRAM_CHANNEL_ID')?.trim() ?? '';
    return channel.startsWith('@')
      ? `https://t.me/${channel.slice(1)}/${messageId}`
      : `https://t.me/c/${channel.replace(/^-100/, '')}/${messageId}`;
  }

  newsLink(id: string): string {
    const base = this.config.get<string>('PUBLIC_WEB_URL') ?? '';
    return `${base.replace(/\/$/, '')}/news/${id}`;
  }

  // ---- The queue -----------------------------------------------------------

  async queue(): Promise<QueueItem[]> {
    const [posts, news] = await Promise.all([
      this.prisma.channelPost.findMany({
        where: { status: { in: ['PENDING', 'SCHEDULED', 'FAILED'] } },
      }),
      this.prisma.news.findMany({
        where: { isDraft: false, publishDate: { gt: new Date() } },
      }),
    ]);
    const items: QueueItem[] = [
      ...posts.map((post) => ({
        kind: 'channel' as const,
        id: post.id,
        publishAt: post.publishAt,
        post,
      })),
      ...news.map((n) => ({
        kind: 'site' as const,
        id: n.id,
        publishAt: n.publishDate,
        news: n,
      })),
    ];
    return items.sort((a, b) => a.publishAt.getTime() - b.publishAt.getTime());
  }

  async item(kind: PostKind, id: string): Promise<QueueItem | null> {
    if (kind === 'channel') {
      const post = await this.prisma.channelPost.findUnique({ where: { id } });
      return post && post.status !== 'PUBLISHED'
        ? { kind, id, publishAt: post.publishAt, post }
        : null;
    }
    const news = await this.prisma.news.findUnique({ where: { id } });
    return news && !news.isDraft && news.publishDate > new Date()
      ? { kind, id, publishAt: news.publishDate, news }
      : null;
  }

  createFromChat(input: {
    text: string;
    media?: PostMedia;
    button: ButtonChoice | null;
    publishAt?: Date;
    author: string;
    sourceMessageId: number;
    approved: boolean;
  }) {
    return this.prisma.channelPost.create({
      data: {
        text: input.text,
        mediaFileId: input.media?.fileId ?? null,
        mediaType: input.media?.type ?? null,
        ...this.channelButton(input.button),
        publishAt: input.publishAt ?? new Date(),
        status: input.approved ? 'SCHEDULED' : 'PENDING',
        author: input.author,
        sourceMessageId: input.sourceMessageId,
      },
    });
  }

  /** A site post from the media chat; waits as a draft until approved. */
  async createNews(input: {
    title: string;
    text: string;
    media?: PostMedia;
    category: NewsCategory | null;
    button: ButtonChoice | null;
    publishAt?: Date;
    approved: boolean;
  }) {
    const image = input.media ? await this.siteCover(input.media) : null;
    return this.prisma.news.create({
      data: {
        title: input.title,
        details: input.text || null,
        image,
        category: input.category,
        publishDate: input.publishAt ?? new Date(),
        isDraft: !input.approved,
        ...(await this.siteButton(input.button)),
      },
    });
  }

  private async siteCover(media: PostMedia): Promise<string> {
    const url = await this.bot.downloadToUploads(
      media.fileId,
      media.type === 'photo' ? '.jpg' : '.mp4',
    );
    if (media.type === 'photo') {
      // Same size and quality as photos uploaded in the admin panel.
      await reencodeImage(
        resolve(UPLOAD_DIR, basename(url)),
        '.jpg',
        ADMIN_IMAGE_PROFILE,
      ).catch((err) =>
        this.logger.warn('Cover re-encode failed: ' + errorMessage(err)),
      );
    }
    return url;
  }

  private channelButton(choice: ButtonChoice | null) {
    if (!choice) return { buttonText: null, buttonUrl: null };
    if ('url' in choice)
      return { buttonText: choice.text, buttonUrl: choice.url };
    return {
      buttonText: 'Зареєструватися',
      buttonUrl: this.eventButtonUrl(choice.eventId),
    };
  }

  /** On the site an event registration is the news' event card, a link a button under it. */
  private async siteButton(choice: ButtonChoice | null) {
    if (choice && 'eventId' in choice) {
      const event = await this.prisma.event.findUnique({
        where: { id: choice.eventId },
        select: { id: true, date: true, location: true },
      });
      if (!event) throw new NotFoundException('Захід не знайдено');
      return {
        eventDate: event.date,
        eventLocation: event.location?.slice(0, 100) ?? null,
        registrationLink: `/events/${event.id}#register`,
        buttonText: null,
      };
    }
    return {
      eventDate: null,
      eventLocation: null,
      registrationLink: choice?.url ?? null,
      buttonText: choice?.text ?? null,
    };
  }

  /** Edits a queued post (the /queue command in the media chat). */
  async change(kind: PostKind, id: string, c: PostChanges): Promise<void> {
    if (kind === 'channel') {
      const post = await this.prisma.channelPost.findUnique({ where: { id } });
      if (!post || post.status === 'PUBLISHED') {
        throw new BadRequestException(GONE);
      }
      const text = c.text ?? post.text;
      const problem = lengthProblem(
        text,
        !!(post.imageUrl || post.mediaFileId),
      );
      if (problem) throw new BadRequestException(problem);
      await this.prisma.channelPost.update({
        where: { id },
        data: {
          text,
          ...(c.button !== undefined && this.channelButton(c.button)),
          ...(c.publishAt && {
            publishAt: c.publishAt,
            ...(post.status === 'FAILED' && {
              status: 'SCHEDULED' as const,
              error: null,
            }),
          }),
        },
      });
      return;
    }
    if (!(await this.item('site', id))) throw new BadRequestException(GONE);
    await this.prisma.news.update({
      where: { id },
      data: {
        ...(c.publishAt && { publishDate: c.publishAt }),
        ...(c.text !== undefined && { details: c.text || null }),
        ...(c.title !== undefined && { title: c.title }),
        ...(c.category !== undefined && { category: c.category }),
        ...(c.button !== undefined && (await this.siteButton(c.button))),
      },
    });
  }

  /** The admin panel's edit of a channel post. */
  async updatePost(id: string, dto: UpdateChannelPostDto) {
    const post = await this.prisma.channelPost.findUnique({ where: { id } });
    if (!post || post.status === 'PUBLISHED') {
      throw new BadRequestException(GONE);
    }
    const mediaChanged = dto.imageUrl !== undefined;
    const text = dto.text ?? post.text;
    const problem = lengthProblem(
      text,
      mediaChanged ? !!dto.imageUrl : !!(post.imageUrl || post.mediaFileId),
    );
    if (problem) throw new BadRequestException(problem);
    return this.prisma.channelPost.update({
      where: { id },
      data: {
        text,
        ...(mediaChanged && {
          imageUrl: dto.imageUrl || null,
          mediaFileId: null,
          mediaType: null,
        }),
        ...(dto.buttonUrl !== undefined &&
          this.channelButton(
            dto.buttonUrl
              ? {
                  text: dto.buttonText?.trim() || 'Перейти',
                  url: dto.buttonUrl.trim(),
                }
              : null,
          )),
        ...(dto.publishAt && {
          publishAt: dto.publishAt,
          ...(post.status === 'FAILED' && {
            status: 'SCHEDULED' as const,
            error: null,
          }),
        }),
      },
    });
  }

  /** Approves a request from the media chat; returns what happened. */
  async approve(kind: PostKind, id: string): Promise<string> {
    const now = new Date();
    if (kind === 'channel') {
      const post = await this.prisma.channelPost.findUnique({ where: { id } });
      if (post?.status !== 'PENDING') throw new BadRequestException(HANDLED);
      if (post.publishAt > now) {
        await this.prisma.channelPost.update({
          where: { id },
          data: { status: 'SCHEDULED' },
        });
        return `заплановано на ${formatKyiv(post.publishAt)}`;
      }
      return this.publishNow('channel', id);
    }
    const news = await this.prisma.news.findUnique({ where: { id } });
    if (!news?.isDraft) throw new BadRequestException(HANDLED);
    const later = news.publishDate > now;
    await this.prisma.news.update({
      where: { id },
      data: { isDraft: false, ...(!later && { publishDate: now }) },
    });
    return later
      ? `заплановано на ${formatKyiv(news.publishDate)}`
      : `опубліковано: ${this.newsLink(id)}`;
  }

  async reject(kind: PostKind, id: string): Promise<void> {
    const { count } =
      kind === 'channel'
        ? await this.prisma.channelPost.deleteMany({
            where: { id, status: 'PENDING' },
          })
        : await this.prisma.news.deleteMany({ where: { id, isDraft: true } });
    if (!count) throw new BadRequestException(HANDLED);
  }

  /** Publishes a queued post right away; returns a line for the chat. */
  async publishNow(kind: PostKind, id: string): Promise<string> {
    if (kind === 'channel') {
      const messageId = await this.publish(id);
      if (!messageId) throw new BadRequestException('Пост уже опубліковано');
      return `опубліковано: ${this.postLink(messageId)}`;
    }
    const now = new Date();
    const { count } = await this.prisma.news.updateMany({
      where: { id, isDraft: false, publishDate: { gt: now } },
      data: { publishDate: now },
    });
    if (!count) throw new BadRequestException(GONE);
    return `опубліковано: ${this.newsLink(id)}`;
  }

  /** Takes a post off the queue; never one that is already out. */
  async remove(kind: PostKind, id: string): Promise<void> {
    const { count } =
      kind === 'channel'
        ? await this.prisma.channelPost.deleteMany({
            where: { id, status: { not: 'PUBLISHED' } },
          })
        : await this.prisma.news.deleteMany({
            where: {
              id,
              OR: [{ isDraft: true }, { publishDate: { gt: new Date() } }],
            },
          });
    if (!count) {
      throw new BadRequestException(
        'Пост уже опубліковано — з черги його не прибрати',
      );
    }
  }
}
