import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { paginated, skipFor } from '../../common/pagination';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';

@Injectable()
export class PartnerService {
  constructor(private readonly prisma: PrismaService) {}

  apply(dto: CreatePartnerDto) {
    return this.prisma.partner.create({
      data: { ...dto, isApproved: false },
    });
  }

  create(dto: CreatePartnerDto) {
    return this.prisma.partner.create({
      data: { ...dto, isApproved: true },
    });
  }

  async findAll({ page, limit }: PaginationQueryDto, includePending = false) {
    const where = includePending ? undefined : { isApproved: true };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.partner.findMany({
        where,
        skip: skipFor(page, limit),
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.partner.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOne(id: string) {
    const partner = await this.prisma.partner.findUnique({ where: { id } });
    if (!partner) {
      throw new NotFoundException(`Partner ${id} not found`);
    }
    return partner;
  }

  async approve(id: string) {
    await this.findOne(id);
    return this.prisma.partner.update({
      where: { id },
      data: { isApproved: true },
    });
  }

  async update(id: string, dto: UpdatePartnerDto) {
    await this.findOne(id);
    return this.prisma.partner.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.partner.delete({ where: { id } });
  }
}
