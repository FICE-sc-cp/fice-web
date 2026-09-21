import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateBlockedUserDto } from './dto/create-blocked-user.dto';
import { UpdateBlockedUserDto } from './dto/update-blocked-user.dto';
import { parseKpiGroup } from '../../common/kpi-groups';

function normalizeTag(tag: string): string {
  const clean = tag.trim().replace(/^@+/, '');
  return `@${clean.toLowerCase()}`;
}

@Injectable()
export class BlockedUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(search?: string) {
    const where: any = {};
    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      where.OR = [
        { telegramTag: { contains: q, mode: 'insensitive' } },
        { group: { contains: q, mode: 'insensitive' } },
        { faculty: { contains: q, mode: 'insensitive' } },
        { reason: { contains: q, mode: 'insensitive' } },
      ];
    }
    return this.prisma.blockedUser.findMany({
      where,
      orderBy: { blockedAt: 'desc' },
    });
  }

  async isTagBlocked(telegramTag: string): Promise<boolean> {
    const normalized = normalizeTag(telegramTag);
    const user = await this.prisma.blockedUser.findUnique({
      where: { telegramTag: normalized },
    });
    return !!(user && user.isBlocked);
  }

  async blockUser(dto: CreateBlockedUserDto) {
    const normalizedTag = normalizeTag(dto.telegramTag);
    let faculty = dto.faculty;
    if (!faculty && dto.group) {
      const parsed = parseKpiGroup(dto.group);
      if (parsed.valid && parsed.faculty) {
        faculty = parsed.faculty;
      }
    }

    return this.prisma.blockedUser.upsert({
      where: { telegramTag: normalizedTag },
      create: {
        telegramTag: normalizedTag,
        group: dto.group?.trim(),
        faculty,
        reason: dto.reason?.trim() || 'Заблоковано адміністратором',
        isBlocked: dto.isBlocked !== undefined ? dto.isBlocked : true,
      },
      update: {
        group: dto.group?.trim(),
        faculty,
        reason: dto.reason?.trim() || 'Заблоковано адміністратором',
        isBlocked: dto.isBlocked !== undefined ? dto.isBlocked : true,
      },
    });
  }

  async update(id: string, dto: UpdateBlockedUserDto) {
    const existing = await this.prisma.blockedUser.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`BlockedUser ${id} not found`);

    let faculty = dto.faculty ?? existing.faculty;
    if (dto.group && !dto.faculty) {
      const parsed = parseKpiGroup(dto.group);
      if (parsed.valid && parsed.faculty) {
        faculty = parsed.faculty;
      }
    }

    return this.prisma.blockedUser.update({
      where: { id },
      data: {
        group: dto.group !== undefined ? dto.group?.trim() : undefined,
        faculty,
        reason: dto.reason !== undefined ? dto.reason?.trim() : undefined,
        isBlocked: dto.isBlocked !== undefined ? dto.isBlocked : undefined,
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.blockedUser.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`BlockedUser ${id} not found`);
    return this.prisma.blockedUser.delete({ where: { id } });
  }
}
