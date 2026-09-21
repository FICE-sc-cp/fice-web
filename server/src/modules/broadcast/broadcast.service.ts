import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BroadcastTarget } from '@prisma/client';
import { UserBotService } from '../../bot/user-bot.service';
import { skipFor } from '../../common/pagination';
import { PrismaService } from '../../database/prisma.service';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';

@Injectable()
export class BroadcastService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userBot: UserBotService,
    private readonly configService: ConfigService,
  ) {}

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

    const botUsername =
      this.configService.get<string>('USER_BOT_USERNAME') || 'fice_event_bot';
    const appName =
      this.configService.get<string>('USER_MINI_APP_NAME') || 'app';
    const publicWebUrl =
      this.configService.get<string>('PUBLIC_WEB_URL') || '';
    const userMiniAppUrl =
      this.configService.get<string>('USER_MINI_APP_URL') ||
      (publicWebUrl ? `${publicWebUrl.replace(/\/$/, '')}/app` : `https://t.me/${botUsername}/${appName}`);
    const defaultUrl = `${userMiniAppUrl}?startapp=event_${eventId}`;
    const buttonUrl =
      dto.buttonUrl?.trim() || (dto.buttonText?.trim() ? defaultUrl : undefined);

    const result = await this.userBot.sendBroadcast(recipients, {
      text: dto.text,
      imageUrl: dto.imageUrl,
      button:
        dto.buttonText && buttonUrl
          ? { text: dto.buttonText, url: buttonUrl }
          : undefined,
    });

    const record = await this.prisma.broadcastMessage.create({
      data: {
        eventId,
        target: BroadcastTarget.EVENT_PARTICIPANTS,
        text: dto.text,
        imageUrl: dto.imageUrl,
        buttonText: dto.buttonText,
        buttonUrl,
        recipientsCount: recipients.length,
        sentCount: result.sent,
        failedCount: result.failed,
      },
    });

    return {
      id: record.id,
      ok: true,
      recipientsCount: recipients.length,
      sentCount: result.sent,
      failedCount: result.failed,
    };
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

    const result = await this.userBot.sendBroadcast(recipients, {
      text: dto.text,
      imageUrl: dto.imageUrl,
      button:
        dto.buttonText && dto.buttonUrl
          ? { text: dto.buttonText, url: dto.buttonUrl }
          : undefined,
    });

    const record = await this.prisma.broadcastMessage.create({
      data: {
        target: BroadcastTarget.ALL_BOT_USERS,
        text: dto.text,
        imageUrl: dto.imageUrl,
        buttonText: dto.buttonText,
        buttonUrl: dto.buttonUrl,
        recipientsCount: recipients.length,
        sentCount: result.sent,
        failedCount: result.failed,
      },
    });

    return {
      id: record.id,
      ok: true,
      recipientsCount: recipients.length,
      sentCount: result.sent,
      failedCount: result.failed,
    };
  }

  async getEventPreview(eventId: string) {
    const count = await this.prisma.eventRegistration.count({
      where: {
        eventId,
        telegramUserId: { not: null },
      },
    });

    const botUsername =
      this.configService.get<string>('USER_BOT_USERNAME') || 'fice_event_bot';
    const appName =
      this.configService.get<string>('USER_MINI_APP_NAME') || 'app';
    const publicWebUrl =
      this.configService.get<string>('PUBLIC_WEB_URL') || '';
    const userMiniAppUrl =
      this.configService.get<string>('USER_MINI_APP_URL') ||
      (publicWebUrl ? `${publicWebUrl.replace(/\/$/, '')}/app` : `https://t.me/${botUsername}/${appName}`);

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
