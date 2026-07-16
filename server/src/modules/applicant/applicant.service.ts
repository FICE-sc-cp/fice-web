import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { BotService } from '../../bot/bot.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { paginated, skipFor } from '../../common/pagination';
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
    const { departments, ...rest } = dto;
    const applicant = await this.prisma.applicant.create({
      data: {
        ...rest,
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
