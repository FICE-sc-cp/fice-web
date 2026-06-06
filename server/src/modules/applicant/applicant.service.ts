import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { paginated, skipFor } from '../../common/pagination';
import { CreateApplicantDto } from './dto/create-applicant.dto';

@Injectable()
export class ApplicantService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    applicantDepartments: { include: { department: true } },
  };

  create(dto: CreateApplicantDto) {
    const { departments, ...rest } = dto;
    return this.prisma.applicant.create({
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
    // ApplicantDepartment rows are removed via onDelete: Cascade.
    return this.prisma.applicant.delete({ where: { id } });
  }
}
