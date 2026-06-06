import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateEventDetailsDto } from './dto/create-event-details.dto';
import { UpdateEventDetailsDto } from './dto/update-event-details.dto';

@Injectable()
export class EventDetailsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateEventDetailsDto) {
    const { departmentId, ...rest } = dto;
    return this.prisma.eventDetails.create({
      data: {
        ...rest,
        department: departmentId
          ? { connect: { id: departmentId } }
          : undefined,
      },
    });
  }

  findAll() {
    return this.prisma.eventDetails.findMany({
      include: { department: true, event: true },
    });
  }

  async findOne(id: string) {
    const details = await this.prisma.eventDetails.findUnique({
      where: { id },
      include: { department: true, event: true },
    });
    if (!details) {
      throw new NotFoundException(`Event details ${id} not found`);
    }
    return details;
  }

  async update(id: string, dto: UpdateEventDetailsDto) {
    await this.findOne(id);
    const { departmentId, ...rest } = dto;
    return this.prisma.eventDetails.update({
      where: { id },
      data: {
        ...rest,
        ...(departmentId !== undefined
          ? { department: { connect: { id: departmentId } } }
          : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.eventDetails.delete({ where: { id } });
  }
}
