import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { BotService } from '../../bot/bot.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { paginated, skipFor } from '../../common/pagination';
import { parseKpiGroup } from '../../common/kpi-groups';
import { CreateApplicantDto } from './dto/create-applicant.dto';

@Injectable()
export class ApplicantService {
  private readonly logger = new Logger(ApplicantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: BotService,
  ) {}

  private readonly include = {
    applicantDepartments: { include: { department: true } },
  };

  async create(dto: CreateApplicantDto) {
    // 1. Group validation & check FICT
    const parsedGroup = parseKpiGroup(dto.group);
    if (!parsedGroup.valid) {
      throw new BadRequestException(parsedGroup.error || 'Невірний формат академічної групи');
    }
    if (parsedGroup.faculty !== 'ФІОТ') {
      throw new BadRequestException(
        `Подати заявку до Студради ФІОТ можуть лише студенти ФІОТ (виявлено: ${parsedGroup.facultyName || parsedGroup.faculty})`,
      );
    }

    // 2. Phone validation (prohibit aggressor countries)
    const cleanPhone = dto.phoneNumber.replace(/[\s\-\(\)\.]/g, '');
    if (/^(\+?7|89\d{9}$|80\d{9}$)/.test(cleanPhone) || /^\+?7\d{10}$/.test(cleanPhone)) {
      throw new BadRequestException('Номери країни-агресора (росії) заборонені');
    }
    if (/^\+?375/.test(cleanPhone)) {
      throw new BadRequestException('Номери країни-агресора (білорусі) заборонені');
    }
    if (!/^(\+?380|0)\d{9}$/.test(cleanPhone) && !/^\+[1-9]\d{8,14}$/.test(cleanPhone)) {
      throw new BadRequestException('Вкажи дійсний номер телефону (наприклад: +380 99 123 45 67)');
    }

    // 3. Telegram tag validation
    const cleanTag = dto.telegramTag.trim().replace(/^@+/, '');
    if (cleanTag.length < 5 || cleanTag.length > 32 || !/^[a-zA-Z0-9_]+$/.test(cleanTag)) {
      throw new BadRequestException('Невірний формат Telegram-тегу (5-32 символи, латиниця, цифри, _)');
    }
    if (!/[a-zA-Z]/.test(cleanTag)) {
      throw new BadRequestException('Telegram-тег повинен містити хоча б одну літеру');
    }

    // 4. Textarea substantive validation
    if (dto.motivation) {
      if (/^[\s\p{P}\p{S}]+$/u.test(dto.motivation)) {
        throw new BadRequestException('Поле мотивації не може містити лише розділові знаки чи символи');
      }
      const letters = (dto.motivation.match(/[\p{L}]/gu) || []).length;
      if (letters < 10) {
        throw new BadRequestException('Текст мотивації має містити змістовні слова, а не лише символи');
      }
    }

    if (dto.experience) {
      if (/^[\s\p{P}\p{S}]+$/u.test(dto.experience)) {
        throw new BadRequestException('Поле досвіду не може містити лише розділові знаки чи символи');
      }
    }

    const { departments, ...rest } = dto;
    const formattedPhone = cleanPhone.startsWith('0')
      ? `+38${cleanPhone}`
      : cleanPhone.startsWith('+')
        ? cleanPhone
        : `+${cleanPhone}`;

    const applicant = await this.prisma.applicant.create({
      data: {
        ...rest,
        group: parsedGroup.normalized,
        telegramTag: `@${cleanTag}`,
        phoneNumber: formattedPhone,
        applicantDepartments: {
          create: departments.map((d) => ({
            department: { connect: { id: d.departmentId } },
            question: d.question,
          })),
        },
      },
      include: this.include,
    });

    void this.notifyHeads(applicant).catch((err) =>
      this.logger.warn('Applicant notification failed: ' + String(err)),
    );

    return applicant;
  }

  private async notifyHeads(applicant: {
    firstName: string;
    lastName: string;
    group: string;
    telegramTag: string;
    phoneNumber: string;
    applicantDepartments: { departmentId: string }[];
  }) {
    const deptIds = applicant.applicantDepartments.map((ad) => ad.departmentId);
    if (!deptIds.length) return;

    const depts = await this.prisma.department.findMany({
      where: { id: { in: deptIds } },
      include: { head: true },
    });

    const deptNames = depts.map((d) => d.name).join(', ');
    const mentions = depts
      .map((d) => d.head?.telegramTag)
      .filter((t): t is string => !!t)
      .map((t) => (t.startsWith('@') ? t : `@${t}`))
      .join(' ');

    const text = [
      '🆕 Нова заявка на вступ у студраду',
      `${applicant.lastName} ${applicant.firstName} (${applicant.group})`,
      `Контакт: ${applicant.telegramTag}, ${applicant.phoneNumber}`,
      `Департаменти: ${deptNames}`,
      mentions ? `${mentions} — звʼяжіться з кандидатом` : '',
    ]
      .filter(Boolean)
      .join('\n');

    await this.bot.notifyGroup(text);
  }

  async findAll({ page, limit }: PaginationQueryDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.applicant.findMany({
        skip: skipFor(page, limit),
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: this.include,
      }),
      this.prisma.applicant.count(),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOne(id: string) {
    const applicant = await this.prisma.applicant.findUnique({
      where: { id },
      include: this.include,
    });
    if (!applicant) {
      throw new NotFoundException(`Applicant ${id} not found`);
    }
    return applicant;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.applicant.delete({ where: { id } });
  }
}
