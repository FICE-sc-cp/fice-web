import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, RegistrationPayment } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../database/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { paginated, skipFor } from '../../common/pagination';
import { parseKpiGroup } from '../../common/kpi-groups';
import { AddEventPartnerDto } from './dto/add-event-partner.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateEventRegistrationDto } from './dto/create-event-registration.dto';
import { UpdateEventDto } from './dto/update-event.dto';

import { BotService } from '../../bot/bot.service';

const PAYMENT_LABEL: Record<RegistrationPayment, string> = {
  NONE: '—',
  DONATED: 'Задонатив',
  AT_EVENT: 'На заході',
};

const normalizeTags = (tags?: string[]) =>
  (tags ?? [])
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .map((t) => (t.startsWith('@') ? t : `@${t}`));

@Injectable()
export class EventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly botService: BotService,
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
  };

  create(dto: CreateEventDto) {
    const { detailsId, program, questions, partners, checkInStaffTags, ...rest } = dto;
    return this.prisma.event.create({
      data: {
        ...rest,
        checkInStaffTags: checkInStaffTags ? normalizeTags(checkInStaffTags) : [],
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
      where.date = past ? { lt: now } : { gte: now };
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
    return paginated(items, total, page, limit);
  }

  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: this.include,
    });
    if (!event) {
      throw new NotFoundException(`Event ${id} not found`);
    }
    return event;
  }

  async update(id: string, dto: UpdateEventDto) {
    await this.findOne(id);
    const { detailsId, program, questions, partners, checkInStaffTags, ...rest } = dto;

    return this.prisma.$transaction(async (tx) => {
      await tx.event.update({
        where: { id },
        data: {
          ...rest,
          ...(checkInStaffTags !== undefined
            ? { checkInStaffTags: normalizeTags(checkInStaffTags) }
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

      return tx.event.findUnique({ where: { id }, include: this.include });
    });
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

  async register(eventId: string, dto: CreateEventRegistrationDto) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { questions: true },
    });
    if (!event) {
      throw new NotFoundException(`Event ${eventId} not found`);
    }
    if (
      event.registrationCloseDate &&
      event.registrationCloseDate.getTime() < Date.now()
    ) {
      throw new BadRequestException('Реєстрацію на цей захід закрито');
    }

    const answers = dto.answers ?? [];
    const answerMap = new Map(
      answers.map((a) => [a.questionId, (a.value ?? '').trim()]),
    );
    const cleanTag = dto.telegramTag.trim().replace(/^@+/, '');
    const normalizedTag = `@${cleanTag.toLowerCase()}`;

    // 1. Check if user is blocked
    const blocked = await this.prisma.blockedUser.findUnique({
      where: { telegramTag: normalizedTag },
    });
    if (blocked && blocked.isBlocked) {
      throw new ForbiddenException(
        'Ваш обліковий запис Telegram заблоковано для реєстрації на заходи. Зверніться до підтримки: @fice_robot',
      );
    }

    // 2. Check group against event allowed faculties
    if (event.allowedFaculties && event.allowedFaculties.length > 0) {
      const parsed = parseKpiGroup(dto.group);
      if (!parsed.valid) {
        throw new BadRequestException(parsed.error || 'Невірний шифр академічної групи');
      }
      if (!parsed.faculty || !event.allowedFaculties.includes(parsed.faculty)) {
        await this.prisma.blockedUser.upsert({
          where: { telegramTag: normalizedTag },
          create: {
            telegramTag: normalizedTag,
            group: dto.group.trim(),
            faculty: parsed.faculty || null,
            reason: `Спроба реєстрації з недозволеного факультету (${dto.group.trim()}, ${parsed.faculty ?? 'невідомий'}) на захід «${event.name}»`,
            isBlocked: true,
          },
          update: {
            group: dto.group.trim(),
            faculty: parsed.faculty || null,
            reason: `Спроба реєстрації з недозволеного факультету (${dto.group.trim()}, ${parsed.faculty ?? 'невідомий'}) на захід «${event.name}»`,
            isBlocked: true,
          },
        });
        throw new ForbiddenException(
          `Реєстрація доступна лише для студентів [${event.allowedFaculties.join(', ')}]. Ваш Telegram додано до списку заблокованих. Якщо ви помилились у шифрі групи, зверніться до підтримки: @fice_robot`,
        );
      }
    }

    // 2.5 Check if user is already registered for this event
    const existingRegistration = await this.prisma.eventRegistration.findFirst({
      where: {
        eventId,
        OR: [
          { telegramTag: { equals: normalizedTag, mode: 'insensitive' } },
          ...(dto.telegramUserId ? [{ telegramUserId: BigInt(dto.telegramUserId) }] : []),
        ],
      },
    });
    if (existingRegistration) {
      throw new BadRequestException('Ви вже зареєстровані на цей захід');
    }

    for (const q of event.questions) {
      if (q.required && !answerMap.get(q.id)) {
        throw new BadRequestException(
          `Обовʼязкове питання без відповіді: ${q.label}`,
        );
      }
    }

    const validIds = new Set(event.questions.map((q) => q.id));
    const answerData = answers
      .filter((a) => validIds.has(a.questionId) && (a.value ?? '').length > 0)
      .map((a) => ({ questionId: a.questionId, value: a.value }));

    let botUserId: string | undefined;
    let telegramUserId: bigint | undefined;

    if (dto.telegramUserId) {
      telegramUserId = BigInt(dto.telegramUserId);

      const user = await this.prisma.botUser.upsert({
        where: { telegramId: telegramUserId },
        create: {
          telegramId: telegramUserId,
          chatId: telegramUserId,
          username: cleanTag || null,
          fullName: dto.saveProfile ? dto.fullName : null,
          group: dto.saveProfile ? dto.group : null,
          birthDate: dto.saveProfile && dto.birthDate ? dto.birthDate : null,
          phoneNumber: dto.saveProfile && dto.phoneNumber ? dto.phoneNumber : null,
          isBlocked: false,
        },
        update: {
          username: cleanTag || undefined,
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
      botUserId = user.id;
    } else {
      // 3. Registration from website: check if user has started the bot
      const botUser = await this.prisma.botUser.findFirst({
        where: {
          username: { equals: cleanTag, mode: 'insensitive' },
        },
      });

      if (!botUser) {
        // Create pending web registration with token
        const token = randomUUID().replace(/-/g, '');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        await this.prisma.pendingWebRegistration.create({
          data: {
            token,
            eventId,
            payload: dto as any,
            telegramTag: normalizedTag,
            expiresAt,
          },
        });

        const botUsername =
          this.configService.get<string>('USER_BOT_USERNAME') || 'fice_event_bot';

        return {
          requiresBotStart: true,
          token,
          botUrl: `https://t.me/${botUsername}?start=reg_${token}`,
          message: 'Для завершення реєстрації активуйте бота @' + botUsername,
        };
      }

      botUserId = botUser.id;
      telegramUserId = botUser.telegramId;
    }

    const reg = await this.prisma.eventRegistration.create({
      data: {
        event: { connect: { id: eventId } },
        botUser: botUserId ? { connect: { id: botUserId } } : undefined,
        telegramUserId,
        fullName: dto.fullName,
        telegramTag: normalizedTag,
        group: dto.group,
        birthDate: dto.birthDate ?? null,
        payment: dto.payment ?? RegistrationPayment.NONE,
        receiptUrl: dto.receiptUrl ?? null,
        answers: answerData.length ? { create: answerData } : undefined,
      },
      include: { answers: true },
    });

    return {
      ...reg,
      telegramUserId: reg.telegramUserId ? reg.telegramUserId.toString() : null,
    };
  }

  async completePendingRegistration(
    token: string,
    telegramUserId: bigint,
    username?: string,
    firstName?: string,
    lastName?: string,
  ) {
    const pending = await this.prisma.pendingWebRegistration.findUnique({
      where: { token },
      include: { event: true },
    });

    if (!pending) throw new NotFoundException('Реєстраційна сесія не знайдена');
    if (pending.completed) return { alreadyCompleted: true, event: pending.event };
    if (pending.expiresAt < new Date()) {
      throw new BadRequestException('Термін дії посилання реєстрації минув');
    }

    const payload = pending.payload as any;
    const cleanTag = (username || pending.telegramTag).replace(/^@+/, '');
    const normalizedTag = `@${cleanTag.toLowerCase()}`;

    // Upsert BotUser
    const botUser = await this.prisma.botUser.upsert({
      where: { telegramId: telegramUserId },
      create: {
        telegramId: telegramUserId,
        chatId: telegramUserId,
        username: cleanTag || null,
        firstName: firstName || null,
        lastName: lastName || null,
        fullName: payload.fullName || null,
        group: payload.group || null,
        birthDate: payload.birthDate ? new Date(payload.birthDate) : null,
        phoneNumber: payload.phoneNumber || null,
        isBlocked: false,
      },
      update: {
        chatId: telegramUserId,
        username: cleanTag || undefined,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
      },
    });

    const existing = await this.prisma.eventRegistration.findFirst({
      where: {
        eventId: pending.eventId,
        OR: [
          { telegramUserId },
          { telegramTag: { equals: normalizedTag, mode: 'insensitive' } },
        ],
      },
    });

    let reg = existing;
    if (!reg) {
      const questions = await this.prisma.eventQuestion.findMany({
        where: { eventId: pending.eventId },
      });
      const validIds = new Set(questions.map((q) => q.id));
      const answerData = ((payload.answers as any[]) ?? [])
        .filter((a) => validIds.has(a.questionId) && (a.value ?? '').length > 0)
        .map((a) => ({ questionId: a.questionId, value: a.value }));

      reg = await this.prisma.eventRegistration.create({
        data: {
          eventId: pending.eventId,
          botUserId: botUser.id,
          telegramUserId,
          fullName: payload.fullName,
          telegramTag: normalizedTag,
          group: payload.group,
          birthDate: payload.birthDate ? new Date(payload.birthDate) : null,
          payment: payload.payment ?? RegistrationPayment.NONE,
          receiptUrl: payload.receiptUrl ?? null,
          answers: answerData.length ? { create: answerData } : undefined,
        },
        include: { answers: true },
      });
    }

    await this.prisma.pendingWebRegistration.update({
      where: { token },
      data: { completed: true },
    });

    return { completed: true, registration: reg, event: pending.event };
  }

  async getRegistrationSession(token: string) {
    const pending = await this.prisma.pendingWebRegistration.findUnique({
      where: { token },
      include: { event: true },
    });
    if (!pending) throw new NotFoundException('Session not found');

    let registration: any = null;
    if (pending.completed) {
      registration = await this.prisma.eventRegistration.findFirst({
        where: {
          eventId: pending.eventId,
          telegramTag: { equals: pending.telegramTag, mode: 'insensitive' },
        },
      });
    }

    return {
      token: pending.token,
      completed: pending.completed,
      expiresAt: pending.expiresAt,
      event: { id: pending.event.id, name: pending.event.name },
      registration,
    };
  }

  async listRegistrations(eventId: string, { page, limit }: PaginationQueryDto) {
    await this.findOne(eventId);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.eventRegistration.findMany({
        where: { eventId },
        include: { answers: true },
        orderBy: { createdAt: 'desc' },
        skip: skipFor(page, limit),
        take: limit,
      }),
      this.prisma.eventRegistration.count({ where: { eventId } }),
    ]);
    return paginated(items, total, page, limit);
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
      'Оплата',
      'Скрін оплати',
      'Зареєстровано',
      'Присутність',
      'Час відмітки',
      'Хто відмітив',
    ];
    sheet.columns = [...baseHeaders, ...event.questions.map((q) => q.label)].map(
      (header) => ({ header, width: Math.min(40, Math.max(16, header.length + 4)) }),
    );
    sheet.getRow(1).font = { bold: true };

    for (const reg of event.registrations) {
      const answerMap = new Map(reg.answers.map((a) => [a.questionId, a.value]));
      sheet.addRow([
        reg.fullName,
        reg.telegramTag,
        reg.group,
        reg.birthDate ? reg.birthDate.toISOString().slice(0, 10) : '',
        PAYMENT_LABEL[reg.payment],
        reg.receiptUrl ?? '',
        reg.createdAt.toISOString().slice(0, 16).replace('T', ' '),
        reg.attended ? 'ТАК' : 'НІ',
        reg.attendedAt ? reg.attendedAt.toISOString().slice(0, 16).replace('T', ' ') : '',
        reg.attendedBy ?? '',
        ...event.questions.map((q) => answerMap.get(q.id) ?? ''),
      ]);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as ArrayBuffer);
  }

  async verifyCheckInAccess(eventId: string, telegramId?: bigint, username?: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, name: true, checkInStaffTags: true },
    });
    if (!event) throw new NotFoundException(`Event ${eventId} not found`);

    let isAdmin = false;
    const adminGroupId = this.configService.get<string>('ADMIN_GROUP_CHAT_ID');

    if (telegramId && adminGroupId) {
      isAdmin = await this.botService.isUserInChat(adminGroupId, Number(telegramId));
    }

    if (this.configService.get<string>('AUTH_DISABLED') === 'true') {
      isAdmin = true;
    }

    let isStaff = false;
    if (username) {
      const cleanTag = '@' + username.trim().toLowerCase().replace(/^@+/, '');
      isStaff = (event.checkInStaffTags || []).some(
        (tag) => tag.trim().toLowerCase() === cleanTag,
      );
    }

    const canCheckIn = isAdmin || isStaff;
    return { canCheckIn, isAdmin, isStaff, event };
  }

  async getCheckInAccess(eventId: string, telegramId?: bigint, username?: string) {
    const { canCheckIn, isAdmin, isStaff, event } = await this.verifyCheckInAccess(
      eventId,
      telegramId,
      username,
    );
    return { canCheckIn, isAdmin, isStaff, eventName: event.name };
  }

  async getCheckInList(eventId: string, telegramId?: bigint, username?: string) {
    const { canCheckIn, event } = await this.verifyCheckInAccess(
      eventId,
      telegramId,
      username,
    );
    if (!canCheckIn) {
      throw new ForbiddenException('У вас немає доступу до відмітки учасників на цьому заході');
    }

    const registrations = await this.prisma.eventRegistration.findMany({
      where: { eventId },
      orderBy: [
        { attended: 'asc' },
        { createdAt: 'desc' },
      ],
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
      items: registrations.map((r) => ({
        id: r.id,
        fullName: r.fullName,
        telegramTag: r.telegramTag,
        group: r.group,
        birthDate: r.birthDate,
        payment: r.payment,
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
      })),
    };
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
      throw new ForbiddenException('У вас немає доступу до відмітки учасників на цьому заході');
    }

    const reg = await this.prisma.eventRegistration.findFirst({
      where: { id: registrationId, eventId },
    });
    if (!reg) throw new NotFoundException('Реєстрацію не знайдено');

    const staffTag = username ? `@${username.replace(/^@+/, '')}` : (staffName || 'Організатор');

    const updated = await this.prisma.eventRegistration.update({
      where: { id: registrationId },
      data: {
        attended,
        attendedAt: attended ? new Date() : null,
        attendedBy: attended ? staffTag : null,
      },
    });

    const total = await this.prisma.eventRegistration.count({ where: { eventId } });
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
      isAdmin = await this.botService.isUserInChat(adminGroupId, Number(telegramId));
    }
    if (this.configService.get<string>('AUTH_DISABLED') === 'true') {
      isAdmin = true;
    }

    if (isAdmin) {
      const events = await this.prisma.event.findMany({
        where: { isDraft: false },
        orderBy: { date: 'desc' },
        take: 30,
        select: {
          id: true,
          name: true,
          date: true,
          location: true,
          photoUrl: true,
          checkInStaffTags: true,
          _count: { select: { registrations: true } },
        },
      });
      return events.map((e) => ({ ...e, isAdmin: true }));
    }

    if (!username) return [];
    const cleanTag = '@' + username.trim().toLowerCase().replace(/^@+/, '');

    const events = await this.prisma.event.findMany({
      where: {
        isDraft: false,
        checkInStaffTags: { has: cleanTag },
      },
      orderBy: { date: 'desc' },
      take: 30,
      select: {
        id: true,
        name: true,
        date: true,
        location: true,
        photoUrl: true,
        checkInStaffTags: true,
        _count: { select: { registrations: true } },
      },
    });
    return events.map((e) => ({ ...e, isAdmin: false }));
  }
}
