import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BroadcastStatus, BroadcastTarget } from '@prisma/client';
import { BroadcastPayload, UserBotService } from '../../bot/user-bot.service';
import { errorMessage } from '../../common/log-safe';
import { skipFor } from '../../common/pagination';
import { PrismaService } from '../../database/prisma.service';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';

type Recipient = { chatId: bigint; telegramId?: bigint };

export interface NewBroadcast {
  eventId?: string;
  target: BroadcastTarget;
  text: string;
  imageUrl?: string;
  buttonText?: string;
  buttonUrl?: string;
}

@Injectable()
export class BroadcastService implements OnModuleInit {
  private readonly logger = new Logger(BroadcastService.name);
  private delivering?: Promise<void>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly userBot: UserBotService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.prisma.broadcastMessage
      .updateMany({
        where: { status: BroadcastStatus.SENDING },
        data: { status: BroadcastStatus.INTERRUPTED, finishedAt: new Date() },
      })
      .catch((err) =>
        this.logger.warn(
          'Could not mark interrupted broadcasts: ' + errorMessage(err),
        ),
      );
  }

  async startBroadcast(
    broadcast: NewBroadcast,
    recipients: Recipient[],
    payload: BroadcastPayload,
  ) {
    const alreadySending =
      this.delivering !== undefined ||
      (await this.prisma.broadcastMessage.count({
        where: { status: BroadcastStatus.SENDING },
      })) > 0;
    if (alreadySending) {
      throw new ConflictException(
        'Попередня розсилка ще надсилається. Дочекайтеся її завершення — прогрес видно в історії розсилок.',
      );
    }

    let release!: () => void;
    this.delivering = new Promise<void>((resolve) => (release = resolve));
    try {
      const record = await this.prisma.broadcastMessage.create({
        data: {
          ...broadcast,
          recipientsCount: recipients.length,
          status: BroadcastStatus.SENDING,
        },
      });
      void this.deliver(record.id, recipients, payload).finally(() => {
        this.delivering = undefined;
        release();
      });
      return {
        id: record.id,
        ok: true,
        status: BroadcastStatus.SENDING,
        recipientsCount: recipients.length,
      };
    } catch (err) {
      this.delivering = undefined;
      release();
      throw err;
    }
  }

  whenIdle(): Promise<void> {
    return this.delivering ?? Promise.resolve();
  }

  private async deliver(
    id: string,
    recipients: Recipient[],
    payload: BroadcastPayload,
  ) {
    try {
      const result = await this.userBot.sendBroadcast(
        recipients,
        payload,
        async ({ sent, failed }) => {
          await this.prisma.broadcastMessage.update({
            where: { id },
            data: { sentCount: sent, failedCount: failed },
          });
        },
      );
      await this.prisma.broadcastMessage.update({
        where: { id },
        data: {
          sentCount: result.sent,
          failedCount: result.failed,
          status: BroadcastStatus.COMPLETED,
          finishedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error(`Broadcast ${id} stopped: ${errorMessage(err)}`);
      await this.prisma.broadcastMessage
        .update({
          where: { id },
          data: { status: BroadcastStatus.INTERRUPTED, finishedAt: new Date() },
        })
        .catch(() => {});
    }
  }

  async broadcastToEvent(eventId: string, dto: CreateBroadcastDto) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, name: true },
    });
    if (!event) throw new NotFoundException(`Event ${eventId} not found`);

    const registrations = await this.prisma.eventRegistration.findMany({
      where: {
        eventId,
        telegramUserId: { not: null },
      },
      select: { telegramUserId: true },
    });

    const uniqueTgIds = Array.from(
      new Set(registrations.map((r) => r.telegramUserId!).filter(Boolean)),
    );

    const recipients = uniqueTgIds.map((id) => ({
      chatId: id,
      telegramId: id,
    }));

    const botUsername = this.userBot.getUsername();
    const appName =
      this.configService.get<string>('USER_MINI_APP_NAME') || 'app';
    const publicWebUrl = this.configService.get<string>('PUBLIC_WEB_URL') || '';
    const userMiniAppUrl =
      this.configService.get<string>('USER_MINI_APP_URL') ||
      (publicWebUrl
        ? `${publicWebUrl.replace(/\/$/, '')}/app`
        : botUsername
          ? `https://t.me/${botUsername}/${appName}`
          : '');
    const defaultUrl = userMiniAppUrl
      ? `${userMiniAppUrl}?startapp=event_${eventId}`
      : undefined;
    const buttonUrl =
      dto.buttonUrl?.trim() ||
      (dto.buttonText?.trim() ? defaultUrl : undefined);

    return this.startBroadcast(
      {
        eventId,
        target: BroadcastTarget.EVENT_PARTICIPANTS,
        text: dto.text,
        imageUrl: dto.imageUrl,
        buttonText: dto.buttonText,
        buttonUrl,
      },
      recipients,
      {
        text: dto.text,
        imageUrl: dto.imageUrl,
        button:
          dto.buttonText && buttonUrl
            ? { text: dto.buttonText, url: buttonUrl }
            : undefined,
      },
    );
  }

  async broadcastToAll(dto: CreateBroadcastDto) {
    const users = await this.prisma.botUser.findMany({
      where: { isBlocked: false },
      select: { chatId: true, telegramId: true },
    });

    const recipients = users.map((u) => ({
      chatId: u.chatId,
      telegramId: u.telegramId,
    }));

    return this.startBroadcast(
      {
        target: BroadcastTarget.ALL_BOT_USERS,
        text: dto.text,
        imageUrl: dto.imageUrl,
        buttonText: dto.buttonText,
        buttonUrl: dto.buttonUrl,
      },
      recipients,
      {
        text: dto.text,
        imageUrl: dto.imageUrl,
        button:
          dto.buttonText && dto.buttonUrl
            ? { text: dto.buttonText, url: dto.buttonUrl }
            : undefined,
      },
    );
  }

  async getEventPreview(eventId: string) {
    const count = await this.prisma.eventRegistration.count({
      where: {
        eventId,
        telegramUserId: { not: null },
      },
    });

    const botUsername = this.userBot.getUsername();
    const appName =
      this.configService.get<string>('USER_MINI_APP_NAME') || 'app';
    const publicWebUrl = this.configService.get<string>('PUBLIC_WEB_URL') || '';
    const userMiniAppUrl =
      this.configService.get<string>('USER_MINI_APP_URL') ||
      (publicWebUrl
        ? `${publicWebUrl.replace(/\/$/, '')}/app`
        : botUsername
          ? `https://t.me/${botUsername}/${appName}`
          : '');

    return {
      eventId,
      recipientsCount: count,
      botUsername,
      defaultUrls: {
        eventMiniApp: `${userMiniAppUrl}?startapp=event_${eventId}`,
        votingMiniApp: `${userMiniAppUrl}?startapp=event_${eventId}`,
        webEvent: `${publicWebUrl}/events/${eventId}`,
      },
    };
  }

  async getStats() {
    const [totalUsers, activeUsers, totalBroadcasts] = await Promise.all([
      this.prisma.botUser.count(),
      this.prisma.botUser.count({ where: { isBlocked: false } }),
      this.prisma.broadcastMessage.count(),
    ]);
    return { totalUsers, activeUsers, totalBroadcasts };
  }

  async getHistory(page = 1, limit = 20) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.broadcastMessage.findMany({
        include: { event: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: skipFor(page, limit),
        take: limit,
      }),
      this.prisma.broadcastMessage.count(),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
