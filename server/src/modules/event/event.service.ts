import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentStatus,
  Prisma,
  RegistrationPayment,
  RegistrationSource,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../database/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { paginated, skipFor } from '../../common/pagination';
import { parseKpiGroup } from '../../common/kpi-groups';
import { escapeHtml } from '../../common/html';
import {
  normalizeTelegramUsername,
  telegramTagOf,
} from './registration-identity';
import { findActiveBlock } from '../blocked-users/blocklist';
import {
  pastEventsWhere,
  registrationClosedMessage,
  registrationClosedReason,
  upcomingEventsWhere,
  withRegistrationState,
} from './event-timing';
import { createRegistrationGuarded } from './registration-writer';
import { paymentRuleViolation } from './payment-rules';
import { validateAnswers } from './registration-answers';
import { registrationListWhere } from './registration-filters';
import { RegistrationListQueryDto } from './dto/registration-list-query.dto';
import { ageOf } from './age';
import {
  isCheckInStaff,
  normalizeStaffTags,
  resolveStaffTags,
  unresolvedStaffTags,
} from './check-in-staff';
import { ownUploadExists } from '../../upload/own-upload';
import { AddEventPartnerDto } from './dto/add-event-partner.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateEventRegistrationDto } from './dto/create-event-registration.dto';
import { UpdateEventDto } from './dto/update-event.dto';

import { BotService } from '../../bot/bot.service';
import { UserBotService } from '../../bot/user-bot.service';
import { resolveValidatedTelegramUser } from '../../auth/init-data.util';

const PAYMENT_LABEL: Record<RegistrationPayment, string> = {
  NONE: '—',
  DONATED: 'Задонатив',
  AT_EVENT: 'На заході',
};

export const SESSION_TOKEN_PATTERN = /^[0-9a-f]{32}$/;

export function toPublicEvent<
  T extends { checkInStaffTags?: unknown; checkInStaffIds?: unknown },
>(event: T): Omit<T, 'checkInStaffTags' | 'checkInStaffIds'> {
  const { checkInStaffTags, checkInStaffIds, ...rest } = event;
  return rest;
}

@Injectable()
export class EventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly botService: BotService,
    private readonly userBotService: UserBotService,
  ) {}

  private readonly include: Prisma.EventInclude = {
    details: { include: { department: true } },
    eventPartners: {
      include: {
        partner: {
          select: {
            id: true,
            name: true,
            logoImage: true,
            websiteLink: true,
            isApproved: true,
          },
        },
      },
    },
    program: { orderBy: { order: 'asc' } },
    questions: { orderBy: { order: 'asc' } },
    _count: { select: { registrations: true } },
  };

  async create(dto: CreateEventDto) {
    const {
      detailsId,
      program,
      questions,
      partners,
      checkInStaffTags,
      ...rest
    } = dto;
    const staffTags = normalizeStaffTags(checkInStaffTags);
    const staff = await resolveStaffTags(this.prisma, staffTags);
    const event = await this.prisma.event.create({
      data: {
        ...rest,
        checkInStaffTags: staffTags,
        checkInStaffIds: [...staff.values()],
        details: detailsId ? { connect: { id: detailsId } } : undefined,
        eventPartners: partners?.length
          ? {
              create: partners.map((p) => ({
                name: p.name,
                logoImage: p.logoImage,
                websiteLink: p.websiteLink,
              })),
            }
          : undefined,
        program: program?.length
          ? {
              create: program.map((p, i) => ({
                time: p.time,
                title: p.title,
                order: p.order ?? i,
              })),
            }
          : undefined,
        questions: questions?.length
          ? {
              create: questions.map((q, i) => ({
                label: q.label,
                type: q.type,
                required: q.required ?? false,
                options: q.options ?? [],
                order: q.order ?? i,
              })),
            }
          : undefined,
      },
      include: this.include,
    });
    return this.withStaffStatus(withRegistrationState(event));
  }

  async withStaffStatus<
    T extends { checkInStaffTags: string[]; checkInStaffIds: bigint[] },
  >(event: T) {
    const resolved = await resolveStaffTags(
      this.prisma,
      event.checkInStaffTags,
    );
    return {
      ...event,
      checkInStaffUnresolved: unresolvedStaffTags(
        event.checkInStaffTags,
        resolved,
        event.checkInStaffIds,
      ),
    };
  }

  async findAll(
    { page, limit }: PaginationQueryDto,
    past?: boolean,
    abitfest?: boolean,
    includeDrafts: boolean = false,
  ) {
    const now = new Date();
    const where: Prisma.EventWhereInput = {};
    if (!includeDrafts) {
      where.isDraft = false;
    }
    if (past !== undefined) {
      where.AND = [past ? pastEventsWhere(now) : upcomingEventsWhere(now)];
    }
    if (abitfest !== undefined) {
      where.isAbitfest = abitfest;
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        include: this.include,
        skip: skipFor(page, limit),
        take: limit,
        orderBy: { date: past === false ? 'asc' : 'desc' },
      }),
      this.prisma.event.count({ where }),
    ]);
    return paginated(
      items.map((e) => withRegistrationState(e, now)),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: this.include,
    });
    if (!event) {
      throw new NotFoundException(`Event ${id} not found`);
    }
    return withRegistrationState(event);
  }

  async update(id: string, dto: UpdateEventDto) {
    await this.findOne(id);
    const {
      detailsId,
      program,
      questions,
      partners,
      checkInStaffTags,
      ...rest
    } = dto;
    const staffTags =
      checkInStaffTags !== undefined
        ? normalizeStaffTags(checkInStaffTags)
        : undefined;
    const staff = staffTags
      ? await resolveStaffTags(this.prisma, staffTags)
      : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.event.update({
        where: { id },
        data: {
          ...rest,
          ...(staffTags && staff
            ? {
                checkInStaffTags: staffTags,
                checkInStaffIds: [...staff.values()],
              }
            : {}),
          ...(detailsId !== undefined
            ? { details: { connect: { id: detailsId } } }
            : {}),
        },
      });

      if (partners !== undefined) {
        await tx.eventPartner.deleteMany({ where: { eventId: id } });
        if (partners?.length) {
          await tx.eventPartner.createMany({
            data: partners.map((p) => ({
              eventId: id,
              name: p.name,
              logoImage: p.logoImage ?? null,
              websiteLink: p.websiteLink ?? null,
            })),
          });
        }
      }

      if (program !== undefined) {
        await tx.eventProgramItem.deleteMany({ where: { eventId: id } });
        if (program.length) {
          await tx.eventProgramItem.createMany({
            data: program.map((p, i) => ({
              eventId: id,
              time: p.time,
              title: p.title,
              order: p.order ?? i,
            })),
          });
        }
      }

      if (questions !== undefined) {
        const keepIds = questions
          .map((q) => q.id)
          .filter((qid): qid is string => !!qid);
        await tx.eventQuestion.deleteMany({
          where: {
            eventId: id,
            ...(keepIds.length ? { id: { notIn: keepIds } } : {}),
          },
        });
        for (const [i, q] of questions.entries()) {
          const data = {
            label: q.label,
            type: q.type,
            required: q.required ?? false,
            options: q.options ?? [],
            order: q.order ?? i,
          };
          if (q.id) {
            await tx.eventQuestion.update({ where: { id: q.id }, data });
          } else {
            await tx.eventQuestion.create({ data: { ...data, eventId: id } });
          }
        }
      }

      return tx.event.findUniqueOrThrow({
        where: { id },
        include: this.include,
      });
    });
    return this.withStaffStatus(withRegistrationState(updated));
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.event.delete({ where: { id } });
  }

  async addPartner(eventId: string, dto: AddEventPartnerDto) {
    await this.findOne(eventId);
    return this.prisma.eventPartner.create({
      data: {
        event: { connect: { id: eventId } },
        name: dto.name,
        logoImage: dto.logoImage ?? null,
        websiteLink: dto.websiteLink ?? null,
      },
    });
  }

  async removePartner(eventId: string, eventPartnerId: string) {
    const link = await this.prisma.eventPartner.findFirst({
      where: { id: eventPartnerId, eventId },
    });
    if (!link) {
      throw new NotFoundException(
        `Event partner ${eventPartnerId} not found for event ${eventId}`,
      );
    }
    return this.prisma.eventPartner.delete({ where: { id: link.id } });
  }

  async register(
    eventId: string,
    dto: CreateEventRegistrationDto,
    initData?: string,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { questions: true },
    });
    if (!event) {
      throw new NotFoundException(`Event ${eventId} not found`);
    }
    const registeredCount = await this.prisma.eventRegistration.count({
      where: { eventId },
    });
    const closed = registrationClosedReason(event, registeredCount, new Date());
    if (closed) {
      throw new BadRequestException(registrationClosedMessage(closed, event));
    }

    const registrant = this.resolveRegistrant(dto, initData);
    const telegramTag = telegramTagOf(registrant.username);

    // 1. Check if user is blocked
    const blocked = await findActiveBlock(
      this.prisma,
      telegramTag,
      registrant.telegramUserId,
    );
    if (blocked) {
      throw new ForbiddenException(
        'Ваш обліковий запис Telegram заблоковано для реєстрації на заходи. Зверніться до підтримки: @fice_robot',
      );
    }

    // 2. Check group against event allowed faculties
    if (event.allowedFaculties && event.allowedFaculties.length > 0) {
      const parsed = parseKpiGroup(dto.group);
      if (!parsed.valid) {
        throw new BadRequestException(
          parsed.error || 'Невірний шифр академічної групи',
        );
      }
      if (!parsed.faculty || !event.allowedFaculties.includes(parsed.faculty)) {
        throw new ForbiddenException(
          `Реєстрація доступна лише для студентів [${event.allowedFaculties.join(', ')}]. Якщо ви помилились у шифрі групи, зверніться до підтримки: @fice_robot`,
        );
      }
    }

    const answerData = validateAnswers(event.questions, dto.answers ?? []);

    const payment = dto.payment ?? RegistrationPayment.NONE;
    const paymentProblem = paymentRuleViolation(
      event,
      payment,
      !!dto.receiptUrl && ownUploadExists(dto.receiptUrl),
    );
    if (paymentProblem) throw new BadRequestException(paymentProblem);
    const receiptUrl =
      payment === RegistrationPayment.DONATED ? (dto.receiptUrl ?? null) : null;

    if (registrant.telegramUserId === undefined) {
      return this.createPendingWebRegistration(
        eventId,
        {
          ...dto,
          payment,
          receiptUrl: receiptUrl ?? undefined,
          answers: answerData,
        },
        telegramTag,
      );
    }
    const telegramUserId = registrant.telegramUserId;

    const user = await this.prisma.botUser.upsert({
      where: { telegramId: telegramUserId },
      create: {
        telegramId: telegramUserId,
        chatId: telegramUserId,
        username: registrant.username,
        fullName: dto.saveProfile ? dto.fullName : null,
        group: dto.saveProfile ? dto.group : null,
        birthDate: dto.saveProfile && dto.birthDate ? dto.birthDate : null,
        phoneNumber:
          dto.saveProfile && dto.phoneNumber ? dto.phoneNumber : null,
        isBlocked: false,
      },
      update: {
        username: registrant.username,
        ...(dto.saveProfile
          ? {
              fullName: dto.fullName,
              group: dto.group,
              birthDate: dto.birthDate ?? undefined,
              phoneNumber: dto.phoneNumber ?? undefined,
            }
          : {}),
      },
    });

    const paymentStatus =
      payment === RegistrationPayment.DONATED
        ? PaymentStatus.PENDING
        : PaymentStatus.NOT_REQUIRED;

    const result = await createRegistrationGuarded(this.prisma, {
      eventId,
      botUserId: user.id,
      telegramUserId,
      telegramTag,
      fullName: dto.fullName,
      group: dto.group,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
      source: dto.source ?? RegistrationSource.BOT,
      payment,
      paymentStatus,
      receiptUrl,
      phoneNumber: dto.phoneNumber?.trim() || null,
      answers: answerData,
    });
    if (!result.created) {
      throw new BadRequestException('Ви вже зареєстровані на цей захід');
    }
    const reg = result.created;

    if (paymentStatus === PaymentStatus.NOT_REQUIRED) {
      this.userBotService
        .sendTicketToUser(telegramUserId, reg, event)
        .catch(() => {});
    } else {
      this.userBotService
        .sendMessageToUser(
          telegramUserId,
          `🧾 <b>Дякуємо за реєстрацію на захід «${escapeHtml(event.name)}»!</b>\n\nТвій платіж надіслано на перевірку адміністраторам. Щойно оплату підтвердять — бот надішле тобі постійний QR-квиток для входу 🎫`,
          {
            text: 'Мої реєстрації 📱',
            url: `${this.userBotService.getMiniAppUrl()}?tab=my-events`,
          },
        )
        .catch(() => {});
    }

    return { id: reg.id, paymentStatus: reg.paymentStatus };
  }

  private resolveRegistrant(
    dto: CreateEventRegistrationDto,
    initData?: string,
  ): { username: string; telegramUserId?: bigint } {
    if (initData) {
      const resolved = resolveValidatedTelegramUser(
        this.configService,
        initData,
      );
      const username = normalizeTelegramUsername(resolved.username);
      if (!username) {
        throw new BadRequestException(
          'Щоб зареєструватися, встанови username у налаштуваннях Telegram.',
        );
      }
      return { username, telegramUserId: resolved.telegramId };
    }

    const username = normalizeTelegramUsername(dto.telegramTag);
    if (!username) {
      throw new BadRequestException(
        'Вкажи коректний Telegram username: латинські літери, цифри та _, від 4 до 32 символів.',
      );
    }
    if (
      dto.telegramUserId &&
      this.configService.get<string>('AUTH_DISABLED') === 'true'
    ) {
      return { username, telegramUserId: BigInt(dto.telegramUserId) };
    }
    return { username };
  }

  private async createPendingWebRegistration(
    eventId: string,
    dto: CreateEventRegistrationDto,
    telegramTag: string,
  ) {
    const botUsername = this.userBotService.getUsername();
    if (!botUsername) {
      throw new ServiceUnavailableException(
        'Реєстрація через сайт тимчасово недоступна: бот не налаштований.',
      );
    }
    const token = randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.pendingWebRegistration.create({
      data: {
        token,
        eventId,
        payload: dto as any,
        telegramTag,
        expiresAt,
      },
    });

    return {
      requiresBotStart: true as const,
      token,
      botUrl: `https://t.me/${botUsername}?start=reg_${token}`,
    };
  }

  async getRegistrationSession(token: string) {
    const pending = await this.prisma.pendingWebRegistration.findUnique({
      where: { token },
      select: { completed: true, expiresAt: true },
    });
    if (!pending) throw new NotFoundException('Session not found');
    if (!pending.completed && pending.expiresAt < new Date()) {
      throw new GoneException('Session expired');
    }
    return { completed: pending.completed, expiresAt: pending.expiresAt };
  }

  async listRegistrations(eventId: string, query: RegistrationListQueryDto) {
    const { page, limit } = query;
    const event = await this.findOne(eventId);
    const where = registrationListWhere(eventId, query);
    const [
      items,
      matching,
      total,
      webCount,
      botCount,
      attendedCount,
      pendingPaymentCount,
      confirmedPaymentCount,
      rejectedPaymentCount,
    ] = await this.prisma.$transaction([
      this.prisma.eventRegistration.findMany({
        where,
        include: { answers: true },
        orderBy: { createdAt: 'desc' },
        skip: skipFor(page, limit),
        take: limit,
      }),
      this.prisma.eventRegistration.count({ where }),
      this.prisma.eventRegistration.count({ where: { eventId } }),
      this.prisma.eventRegistration.count({
        where: { eventId, source: 'WEB' },
      }),
      this.prisma.eventRegistration.count({
        where: { eventId, source: 'BOT' },
      }),
      this.prisma.eventRegistration.count({
        where: { eventId, attended: true },
      }),
      this.prisma.eventRegistration.count({
        where: { eventId, paymentStatus: 'PENDING' },
      }),
      this.prisma.eventRegistration.count({
        where: { eventId, paymentStatus: 'CONFIRMED' },
      }),
      this.prisma.eventRegistration.count({
        where: { eventId, paymentStatus: 'REJECTED' },
      }),
    ]);

    const closedReason = registrationClosedReason(event, total, new Date());
    const isClosedByDate = closedReason === 'deadline';
    const isClosedByLimit = closedReason === 'capacity';

    return {
      ...paginated(items, matching, page, limit),
      analytics: {
        total,
        webCount,
        botCount,
        attendedCount,
        pendingPaymentCount,
        confirmedPaymentCount,
        rejectedPaymentCount,
        maxRegistrations: event.maxRegistrations ?? null,
        isRegistrationOpen: closedReason === null,
        isClosedByDate,
        isClosedByLimit,
      },
    };
  }

  async exportRegistrations(eventId: string): Promise<Buffer> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        questions: { orderBy: { order: 'asc' } },
        registrations: {
          include: { answers: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!event) {
      throw new NotFoundException(`Event ${eventId} not found`);
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Реєстрації');

    const baseHeaders = [
      'ПІБ',
      'Telegram',
      'Група',
      'Дата народження',
      'Телефон',
      'Джерело',
      'Оплата',
      'Статус оплати',
      'Скрін/Чек',
      'Код квитка',
      'Зареєстровано',
      'Присутність',
      'Час відмітки',
      'Хто відмітив',
    ];
    sheet.columns = [
      ...baseHeaders,
      ...event.questions.map((q) => q.label),
    ].map((header) => ({
      header,
      width: Math.min(40, Math.max(16, header.length + 4)),
    }));
    sheet.getRow(1).font = { bold: true };

    for (const reg of event.registrations) {
      const answerMap = new Map(
        reg.answers.map((a) => [a.questionId, a.value]),
      );
      sheet.addRow([
        reg.fullName,
        reg.telegramTag,
        reg.group,
        reg.birthDate ? reg.birthDate.toISOString().slice(0, 10) : '',
        reg.phoneNumber ?? '',
        reg.source === 'BOT' ? 'Telegram-бот' : 'Сайт',
        PAYMENT_LABEL[reg.payment],
        reg.paymentStatus === 'CONFIRMED'
          ? 'Підтверджено'
          : reg.paymentStatus === 'REJECTED'
            ? `Відхилено${reg.paymentRejectionReason ? `: ${reg.paymentRejectionReason}` : ''}`
            : reg.paymentStatus === 'PENDING'
              ? 'Очікує підтвердження'
              : '—',
        reg.receiptUrl ?? '',
        reg.ticketCode ?? '',
        reg.createdAt.toISOString().slice(0, 16).replace('T', ' '),
        reg.attended ? 'ТАК' : 'НІ',
        reg.attendedAt
          ? reg.attendedAt.toISOString().slice(0, 16).replace('T', ' ')
          : '',
        reg.attendedBy ?? '',
        ...event.questions.map((q) => answerMap.get(q.id) ?? ''),
      ]);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as ArrayBuffer);
  }

  async verifyCheckInAccess(
    eventId: string,
    telegramId?: bigint,
    username?: string,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, name: true, checkInStaffIds: true },
    });
    if (!event) throw new NotFoundException(`Event ${eventId} not found`);

    let isAdmin = false;
    const adminGroupId = this.configService.get<string>('ADMIN_GROUP_CHAT_ID');

    if (telegramId && adminGroupId) {
      isAdmin = await this.botService.isUserInChat(
        adminGroupId,
        Number(telegramId),
      );
    }

    if (this.configService.get<string>('AUTH_DISABLED') === 'true') {
      isAdmin = true;
    }

    const isStaff = isCheckInStaff(event.checkInStaffIds, telegramId);

    const canCheckIn = isAdmin || isStaff;
    return { canCheckIn, isAdmin, isStaff, event };
  }

  async getCheckInAccess(
    eventId: string,
    telegramId?: bigint,
    username?: string,
  ) {
    const { canCheckIn, isAdmin, isStaff, event } =
      await this.verifyCheckInAccess(eventId, telegramId, username);
    return { canCheckIn, isAdmin, isStaff, eventName: event.name };
  }

  async getCheckInList(
    eventId: string,
    telegramId?: bigint,
    username?: string,
  ) {
    const { canCheckIn, isAdmin, event } = await this.verifyCheckInAccess(
      eventId,
      telegramId,
      username,
    );
    if (!canCheckIn) {
      throw new ForbiddenException(
        'У вас немає доступу до відмітки учасників на цьому заході',
      );
    }

    const registrations = await this.prisma.eventRegistration.findMany({
      where: { eventId },
      orderBy: [{ attended: 'asc' }, { createdAt: 'desc' }],
      include: {
        answers: { include: { question: { select: { label: true } } } },
      },
    });

    const total = registrations.length;
    const attendedCount = registrations.filter((r) => r.attended).length;
    const unattendedCount = total - attendedCount;

    return {
      event: {
        id: event.id,
        name: event.name,
      },
      total,
      attendedCount,
      unattendedCount,
      percentage: total > 0 ? Math.round((attendedCount / total) * 100) : 0,
      stats: {
        total,
        attendedCount,
        unattendedCount,
        percentage: total > 0 ? Math.round((attendedCount / total) * 100) : 0,
      },
      items: registrations.map((r) =>
        isAdmin ? this.fullCheckInItem(r) : this.volunteerCheckInItem(r),
      ),
    };
  }

  private volunteerCheckInItem(r: {
    id: string;
    fullName: string;
    telegramTag: string;
    group: string;
    birthDate: Date | null;
    payment: RegistrationPayment;
    paymentStatus: PaymentStatus;
    attended: boolean;
    attendedAt: Date | null;
    attendedBy: string | null;
    createdAt: Date;
  }) {
    const { age, isAdult } = ageOf(r.birthDate);
    return {
      id: r.id,
      fullName: r.fullName,
      telegramTag: r.telegramTag,
      group: r.group,
      payment: r.payment,
      paymentStatus: r.paymentStatus,
      receiptUrl: null,
      attended: r.attended,
      attendedAt: r.attendedAt,
      attendedBy: r.attendedBy,
      createdAt: r.createdAt,
      age,
      isAdult,
      answers: [],
    };
  }

  private fullCheckInItem(
    r: Prisma.EventRegistrationGetPayload<{
      include: {
        answers: { include: { question: { select: { label: true } } } };
      };
    }>,
  ) {
    return {
      id: r.id,
      fullName: r.fullName,
      telegramTag: r.telegramTag,
      group: r.group,
      birthDate: r.birthDate,
      source: r.source,
      payment: r.payment,
      paymentStatus: r.paymentStatus,
      paymentRejectionReason: r.paymentRejectionReason,
      ticketCode: r.ticketCode,
      receiptUrl: r.receiptUrl,
      attended: r.attended,
      attendedAt: r.attendedAt,
      attendedBy: r.attendedBy,
      createdAt: r.createdAt,
      answers: r.answers.map((a) => ({
        id: a.id,
        question: a.question.label,
        value: a.value,
      })),
    };
  }

  async checkInByCode(
    eventId: string,
    rawCode: string,
    telegramId?: bigint,
    username?: string,
    staffName?: string,
  ) {
    const { canCheckIn, isAdmin } = await this.verifyCheckInAccess(
      eventId,
      telegramId,
      username,
    );
    if (!canCheckIn) {
      throw new ForbiddenException(
        'У вас немає доступу до відмітки учасників на цьому заході',
      );
    }
    const visibleBirthDate = (birthDate: Date | null) =>
      isAdmin ? birthDate : undefined;

    let cleanCode = (rawCode || '').trim();
    if (cleanCode.startsWith('FICE-TICKET:')) {
      cleanCode = cleanCode.replace('FICE-TICKET:', '').trim();
    } else if (cleanCode.startsWith('FICE:')) {
      cleanCode = cleanCode.replace('FICE:', '').trim();
    }

    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        cleanCode,
      );
    if (!isUuid) {
      throw new NotFoundException(
        'Квиток не знайдено або він належить іншому заходу',
      );
    }

    const reg = await this.prisma.eventRegistration.findFirst({
      where: {
        eventId,
        OR: [{ ticketCode: cleanCode }, { id: cleanCode }],
      },
    });

    if (!reg) {
      throw new NotFoundException(
        'Квиток не знайдено або він належить іншому заходу',
      );
    }

    let age: number | null = null;
    let isAdult: boolean | null = null;
    if (reg.birthDate) {
      const bd = new Date(reg.birthDate);
      const ageDifMs = Date.now() - bd.getTime();
      const ageDate = new Date(ageDifMs);
      age = Math.abs(ageDate.getUTCFullYear() - 1970);
      isAdult = age >= 18;
    }

    const isPaymentPending =
      reg.payment === 'DONATED' && reg.paymentStatus !== 'CONFIRMED';
    const isPaymentRejected = reg.paymentStatus === 'REJECTED';

    if (reg.attended) {
      return {
        success: false,
        alreadyAttended: true,
        isPaymentPending,
        isPaymentRejected,
        message: `⚠️ Вже відмічено о ${
          reg.attendedAt
            ? new Intl.DateTimeFormat('uk-UA', {
                hour: '2-digit',
                minute: '2-digit',
              }).format(new Date(reg.attendedAt))
            : ''
        } (${reg.attendedBy || 'Організатор'})`,
        registration: {
          id: reg.id,
          fullName: reg.fullName,
          group: reg.group,
          telegramTag: reg.telegramTag,
          birthDate: visibleBirthDate(reg.birthDate),
          source: reg.source,
          payment: reg.payment,
          paymentStatus: reg.paymentStatus,
          ticketCode: reg.ticketCode,
          attended: reg.attended,
          attendedAt: reg.attendedAt,
          attendedBy: reg.attendedBy,
          age,
          isAdult,
        },
      };
    }

    const staffTag = username
      ? `@${username.replace(/^@+/, '')}`
      : staffName || 'Організатор';

    const updated = await this.prisma.eventRegistration.update({
      where: { id: reg.id },
      data: {
        attended: true,
        attendedAt: new Date(),
        attendedBy: staffTag,
      },
    });

    return {
      success: true,
      alreadyAttended: false,
      isPaymentPending,
      isPaymentRejected,
      message: isPaymentRejected
        ? `⛔️ Увага! Оплату учасника було ВІДХИЛЕНО!`
        : isPaymentPending
          ? `⚠️ Відмічено, але оплата ще НЕ підтверджена адміном! Перевірте чек.`
          : `✅ Успішно відмічено: ${reg.fullName}`,
      registration: {
        id: updated.id,
        fullName: updated.fullName,
        group: updated.group,
        telegramTag: updated.telegramTag,
        birthDate: visibleBirthDate(updated.birthDate),
        source: updated.source,
        payment: updated.payment,
        paymentStatus: updated.paymentStatus,
        ticketCode: updated.ticketCode,
        attended: true,
        attendedAt: updated.attendedAt,
        attendedBy: updated.attendedBy,
        age,
        isAdult,
      },
    };
  }

  async confirmPayment(
    eventId: string,
    registrationId: string,
    telegramId?: bigint,
    username?: string,
  ) {
    const { canCheckIn } = await this.verifyCheckInAccess(
      eventId,
      telegramId,
      username,
    );
    if (!canCheckIn) {
      throw new ForbiddenException('У вас немає прав на підтвердження оплати');
    }

    const reg = await this.prisma.eventRegistration.findFirst({
      where: { id: registrationId, eventId },
      include: { event: true },
    });
    if (!reg) throw new NotFoundException('Реєстрацію не знайдено');

    const updated = await this.prisma.eventRegistration.update({
      where: { id: registrationId },
      data: {
        paymentStatus: PaymentStatus.CONFIRMED,
        paymentRejectionReason: null,
      },
      include: { event: true },
    });

    if (updated.telegramUserId) {
      await this.userBotService.sendTicketToUser(
        updated.telegramUserId,
        updated,
        updated.event,
      );
    }

    return updated;
  }

  async rejectPayment(
    eventId: string,
    registrationId: string,
    reason?: string,
    telegramId?: bigint,
    username?: string,
  ) {
    const { canCheckIn } = await this.verifyCheckInAccess(
      eventId,
      telegramId,
      username,
    );
    if (!canCheckIn) {
      throw new ForbiddenException('У вас немає прав на відхилення оплати');
    }

    const reg = await this.prisma.eventRegistration.findFirst({
      where: { id: registrationId, eventId },
      include: { event: true },
    });
    if (!reg) throw new NotFoundException('Реєстрацію не знайдено');

    const updated = await this.prisma.eventRegistration.update({
      where: { id: registrationId },
      data: {
        paymentStatus: PaymentStatus.REJECTED,
        paymentRejectionReason:
          reason || 'Оплату не знайдено або некоректний чек',
      },
      include: { event: true },
    });

    if (updated.telegramUserId) {
      const msg =
        `⚠️ <b>Оплату на захід «${escapeHtml(updated.event.name)}» було відхилено.</b>\n\n` +
        (reason ? `Причина: <i>${escapeHtml(reason)}</i>\n\n` : '') +
        `Будь ласка, зверніться до організаторів або надішліть новий чек у додатку.`;

      await this.userBotService.sendMessageToUser(updated.telegramUserId, msg, {
        text: 'Відкрити мої реєстрації 📱',
        url: `${this.userBotService.getMiniAppUrl()}?tab=my-events`,
      });
    }

    return updated;
  }

  async cancelRegistration(
    eventId: string,
    registrationId: string,
    reason?: string,
  ) {
    const reg = await this.prisma.eventRegistration.findFirst({
      where: { id: registrationId, eventId },
      include: { event: true },
    });
    if (!reg) throw new NotFoundException('Реєстрацію не знайдено');

    await this.prisma.eventRegistration.delete({
      where: { id: registrationId },
    });

    if (reg.telegramUserId) {
      const eventName = reg.event?.name || 'захід';
      const reasonText = reason?.trim()
        ? `\n\n<b>Причина:</b> ${escapeHtml(reason.trim())}`
        : '';
      this.userBotService
        .sendMessageToUser(
          reg.telegramUserId,
          `ℹ️ Вашу реєстрацію на захід "<b>${escapeHtml(eventName)}</b>" було скасовано адміністратором.${reasonText}\n\nЯкщо у вас виникли запитання, будь ласка, зверніться до організаторів.`,
        )
        .catch(() => {});
    }

    return { ok: true, message: 'Реєстрацію успішно скасовано' };
  }

  async toggleCheckIn(
    eventId: string,
    registrationId: string,
    attended: boolean,
    telegramId?: bigint,
    username?: string,
    staffName?: string,
  ) {
    const { canCheckIn } = await this.verifyCheckInAccess(
      eventId,
      telegramId,
      username,
    );
    if (!canCheckIn) {
      throw new ForbiddenException(
        'У вас немає доступу до відмітки учасників на цьому заході',
      );
    }

    const reg = await this.prisma.eventRegistration.findFirst({
      where: { id: registrationId, eventId },
    });
    if (!reg) throw new NotFoundException('Реєстрацію не знайдено');

    const staffTag = username
      ? `@${username.replace(/^@+/, '')}`
      : staffName || 'Організатор';

    const updated = await this.prisma.eventRegistration.update({
      where: { id: registrationId },
      data: {
        attended,
        attendedAt: attended ? new Date() : null,
        attendedBy: attended ? staffTag : null,
      },
    });

    const total = await this.prisma.eventRegistration.count({
      where: { eventId },
    });
    const attendedCount = await this.prisma.eventRegistration.count({
      where: { eventId, attended: true },
    });

    return {
      registration: updated,
      total,
      attendedCount,
      unattendedCount: total - attendedCount,
      percentage: total > 0 ? Math.round((attendedCount / total) * 100) : 0,
      stats: {
        total,
        attendedCount,
        unattendedCount: total - attendedCount,
        percentage: total > 0 ? Math.round((attendedCount / total) * 100) : 0,
      },
    };
  }

  async getCheckInEvents(telegramId?: bigint, username?: string) {
    const adminGroupId = this.configService.get<string>('ADMIN_GROUP_CHAT_ID');
    let isAdmin = false;
    if (telegramId && adminGroupId) {
      isAdmin = await this.botService.isUserInChat(
        adminGroupId,
        Number(telegramId),
      );
    }
    if (this.configService.get<string>('AUTH_DISABLED') === 'true') {
      isAdmin = true;
    }

    if (!isAdmin && telegramId === undefined) return [];

    const events = await this.prisma.event.findMany({
      where: {
        isDraft: false,
        ...(isAdmin ? {} : { checkInStaffIds: { has: telegramId } }),
      },
      orderBy: { date: 'desc' },
      take: 30,
      select: {
        id: true,
        name: true,
        date: true,
        hasTime: true,
        location: true,
        photoUrl: true,
        _count: { select: { registrations: true } },
      },
    });
    return events.map((e) => ({ ...e, isAdmin }));
  }
}
