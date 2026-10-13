import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { paginated, skipFor } from '../../common/pagination';
import { CreateNewsDto } from './dto/create-news.dto';
import { NewsQueryDto, NewsStatsQueryDto } from './dto/news-query.dto';
import { kyivDaysFilter } from '../event/event-timing';
import { UpdateNewsDto } from './dto/update-news.dto';

@Injectable()
export class NewsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateNewsDto) {
    return this.prisma.news.create({ data: dto });
  }

  async findAll({ page, limit, search, category, draft }: NewsQueryDto) {
    const term = search?.trim();
    const where: Prisma.NewsWhereInput = {};
    if (!draft) {
      where.isDraft = false;
    }
    if (category) {
      where.category = category;
    }
    if (term) {
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { details: { contains: term, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.news.findMany({
        where,
        skip: skipFor(page, limit),
        take: limit,
        orderBy: { publishDate: 'desc' },
      }),
      this.prisma.news.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  /** Published news per category between two Kyiv days. */
  async stats({ from, to }: NewsStatsQueryDto) {
    const rows = await this.prisma.news.groupBy({
      by: ['category'],
      where: { isDraft: false, publishDate: kyivDaysFilter(from, to) },
      _count: { _all: true },
    });
    return {
      total: rows.reduce((sum, r) => sum + r._count._all, 0),
      byCategory: Object.fromEntries(
        rows.map((r) => [r.category ?? 'NONE', r._count._all]),
      ),
    };
  }

  async findOne(id: string) {
    const news = await this.prisma.news.findUnique({ where: { id } });
    if (!news) {
      throw new NotFoundException(`News ${id} not found`);
    }
    return news;
  }

  async update(id: string, dto: UpdateNewsDto) {
    await this.findOne(id);
    return this.prisma.news.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.news.delete({ where: { id } });
  }
}
