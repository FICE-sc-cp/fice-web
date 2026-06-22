import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RegistrationPayment } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../database/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { paginated, skipFor } from '../../common/pagination';
import { AddEventPartnerDto } from './dto/add-event-partner.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateEventRegistrationDto } from './dto/create-event-registration.dto';
import { UpdateEventDto } from './dto/update-event.dto';

const PAYMENT_LABEL: Record<RegistrationPayment, string> = {
  NONE: '—',
  DONATED: 'Задонатив',
  AT_EVENT: 'На заході',
};

@Injectable()
export class EventService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include: Prisma.EventInclude = {
    details: { include: { department: true } },
    eventPartners: { include: { partner: true } },
    program: { orderBy: { order: 'asc' } },
    questions: { orderBy: { order: 'asc' } },
  };

  create(dto: CreateEventDto) {
    const { detailsId, program, questions, ...rest } = dto;
    return this.prisma.event.create({
      data: {
        ...rest,
        details: detailsId ? { connect: { id: detailsId } } : undefined,
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

  async findAll({ page, limit }: PaginationQueryDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        include: this.include,
        skip: skipFor(page, limit),
        take: limit,
        orderBy: { date: 'desc' },
      }),
      this.prisma.event.count(),
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
    const { detailsId, program, questions, ...rest } = dto;

    return this.prisma.$transaction(async (tx) => {
      await tx.event.update({
        where: { id },
        data: {
          ...rest,
          ...(detailsId !== undefined
            ? { details: { connect: { id: detailsId } } }
            : {}),
        },
      });

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

    return this.prisma.eventRegistration.create({
      data: {
        event: { connect: { id: eventId } },
        fullName: dto.fullName,
        telegramTag: dto.telegramTag,
        group: dto.group,
        birthDate: dto.birthDate ?? null,
        payment: dto.payment ?? RegistrationPayment.NONE,
        receiptUrl: dto.receiptUrl ?? null,
        answers: answerData.length ? { create: answerData } : undefined,
      },
      include: { answers: true },
    });
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
        ...event.questions.map((q) => answerMap.get(q.id) ?? ''),
      ]);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as ArrayBuffer);
  }
}
