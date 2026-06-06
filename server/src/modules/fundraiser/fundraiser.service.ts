import { Injectable, NotFoundException } from '@nestjs/common';
import { FundraiserStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { paginated, skipFor } from '../../common/pagination';
import { CreateFundraiserDto } from './dto/create-fundraiser.dto';
import { UpdateFundraiserDto } from './dto/update-fundraiser.dto';

@Injectable()
export class FundraiserService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateFundraiserDto) {
    return this.prisma.fundraiser.create({
      data: {
        name: dto.name,
        status: dto.status ?? FundraiserStatus.ACTIVE,
        description: dto.description,
        goalAmount: dto.goalAmount,
        currentAmount: dto.currentAmount ?? 0,
        startDate: dto.startDate,
        endDate: dto.endDate,
        detailsLink: dto.detailsLink,
      },
    });
  }

  async findAll(
    { page, limit }: PaginationQueryDto,
    status?: FundraiserStatus,
  ) {
    const where = status ? { status } : undefined;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.fundraiser.findMany({
        where,
        skip: skipFor(page, limit),
        take: limit,
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.fundraiser.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOne(id: string) {
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { id },
    });
    if (!fundraiser) {
      throw new NotFoundException(`Fundraiser ${id} not found`);
    }
    return fundraiser;
  }

  async update(id: string, dto: UpdateFundraiserDto) {
    await this.findOne(id);
    return this.prisma.fundraiser.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.fundraiser.delete({ where: { id } });
  }
}
