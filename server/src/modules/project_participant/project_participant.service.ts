import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ProjectParticipantSource } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateProjectParticipantDto } from './dto/create-project-participant.dto';
import { UpdateProjectParticipantDto } from './dto/update-project-participant.dto';

export interface TelegramUserLike {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

// Fields safe to return over HTTP. Excludes the BigInt `telegramId` (not
// JSON-serializable and not needed by any client) and the internal `avatarFileId`.
const adminSelect = {
  id: true,
  fullName: true,
  telegramTag: true,
  photo: true,
  source: true,
  hidden: true,
  departmentId: true,
  lastSeenAt: true,
  createdAt: true,
} as const;

@Injectable()
export class ProjectParticipantService {
  private readonly logger = new Logger(ProjectParticipantService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---- Bot-facing (harvesting) -------------------------------------------

  /**
   * Upsert a participant seen in a department chat. Returns the row id and
   * whether it was newly created (the bot fetches an avatar only for new rows,
   * to avoid an API call on every message).
   */
  async upsertFromTelegram(
    user: TelegramUserLike,
    departmentId: string,
  ): Promise<{ id: string; created: boolean }> {
    const telegramId = BigInt(user.id);
    const fullName =
      [user.first_name, user.last_name].filter(Boolean).join(' ').trim() ||
      `id${user.id}`;
    const telegramTag = user.username ? `@${user.username}` : null;

    const existing = await this.prisma.projectParticipant.findUnique({
      where: { departmentId_telegramId: { departmentId, telegramId } },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.projectParticipant.update({
        where: { id: existing.id },
        data: { fullName, telegramTag, lastSeenAt: new Date() },
      });
      return { id: existing.id, created: false };
    }

    // Reuse an already-downloaded avatar of the same person from another chat.
    const twin = await this.prisma.projectParticipant.findFirst({
      where: { telegramId, photo: { not: null } },
      select: { photo: true, avatarFileId: true },
    });

    const created = await this.prisma.projectParticipant.create({
      data: {
        telegramId,
        fullName,
        telegramTag,
        departmentId,
        photo: twin?.photo,
        avatarFileId: twin?.avatarFileId,
        source: ProjectParticipantSource.HARVESTED,
      },
      select: { id: true, photo: true },
    });
    return { id: created.id, created: !created.photo };
  }

  async setAvatar(
    id: string,
    photo: string,
    avatarFileId: string,
  ): Promise<void> {
    await this.prisma.projectParticipant.update({
      where: { id },
      data: { photo, avatarFileId },
    });
  }

  // ---- Admin CRUD ---------------------------------------------------------

  findAllAdmin() {
    return this.prisma.projectParticipant.findMany({
      select: adminSelect,
      orderBy: [{ hidden: 'asc' }, { fullName: 'asc' }],
    });
  }

  create(dto: CreateProjectParticipantDto) {
    return this.prisma.projectParticipant.create({
      data: { ...dto, source: ProjectParticipantSource.MANUAL },
      select: adminSelect,
    });
  }

  async update(id: string, dto: UpdateProjectParticipantDto) {
    await this.findOne(id);
    return this.prisma.projectParticipant.update({
      where: { id },
      data: dto,
      select: adminSelect,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.projectParticipant.delete({
      where: { id },
      select: { id: true },
    });
  }

  // ---- Public read (department people walls) ------------------------------

  findPublic(departmentId?: string) {
    return this.prisma.projectParticipant.findMany({
      where: { hidden: false, ...(departmentId ? { departmentId } : {}) },
      select: { fullName: true, telegramTag: true, photo: true },
      orderBy: { fullName: 'asc' },
    });
  }

  private async findOne(id: string) {
    const found = await this.prisma.projectParticipant.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException(`Project participant ${id} not found`);
    }
    return found;
  }
}
