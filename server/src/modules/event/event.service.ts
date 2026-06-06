import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { paginated, skipFor } from '../../common/pagination';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include: Prisma.EventInclude = {
    details: { include: { department: true } },
    eventPartners: { include: { partner: true } },
  };

  create(dto: CreateEventDto) {
    const { detailsId, ...rest } = dto;
    return this.prisma.event.create({
      data: {
        ...rest,
        details: detailsId ? { connect: { id: detailsId } } : undefined,
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
    const { detailsId, ...rest } = dto;
    return this.prisma.event.update({
      where: { id },
      data: {
        ...rest,
        ...(detailsId !== undefined
          ? { details: { connect: { id: detailsId } } }
          : {}),
      },
      include: this.include,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.event.delete({ where: { id } });
  }

  async addPartner(eventId: string, partnerId: string) {
    await this.findOne(eventId);
    return this.prisma.eventPartner.create({
      data: {
        event: { connect: { id: eventId } },
        partner: { connect: { id: partnerId } },
      },
    });
  }

  async removePartner(eventId: string, partnerId: string) {
    const link = await this.prisma.eventPartner.findFirst({
      where: { eventId, partnerId },
    });
    if (!link) {
      throw new NotFoundException(
        `Partner ${partnerId} is not attached to event ${eventId}`,
      );
    }
    return this.prisma.eventPartner.delete({ where: { id: link.id } });
  }
}
