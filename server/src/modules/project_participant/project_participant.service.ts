import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, ProjectParticipantSource } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateProjectParticipantDto } from './dto/create-project-participant.dto';
import { UpdateProjectParticipantDto } from './dto/update-project-participant.dto';

const FULL_NAME_MAX = 120;

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
  ): Promise<{ id: string; isNew: boolean; needsAvatar: boolean }> {
    const telegramId = BigInt(user.id);
    const fullName = Array.from(
      [user.first_name, user.last_name].filter(Boolean).join(' ').trim() ||
        `id${user.id}`,
    )
      .slice(0, FULL_NAME_MAX)
      .join('');
    const telegramTag = user.username ? `@${user.username}` : null;

    const existing = await this.findHarvested(departmentId, telegramId);
    if (existing) {
      await this.touch(existing, fullName, telegramTag);
      return { id: existing.id, isNew: false, needsAvatar: false };
    }

    if (user.username) {
      const wanted = user.username.toLowerCase();
      const candidates = await this.prisma.projectParticipant.findMany({
        where: { departmentId, telegramId: null, telegramTag: { not: null } },
        select: { id: true, photo: true, telegramTag: true },
      });
      const manual = candidates.find(
        (r) =>
          (r.telegramTag ?? '').trim().replace(/^@/, '').toLowerCase() ===
          wanted,
      );
      if (manual) {
        await this.prisma.projectParticipant.update({
          where: { id: manual.id },
          data: { telegramId, lastSeenAt: new Date() },
        });
        return { id: manual.id, isNew: false, needsAvatar: !manual.photo };
      }
    }

    // Reuse an already-downloaded avatar of the same person from another chat.
    const twin = await this.prisma.projectParticipant.findFirst({
      where: { telegramId, photo: { not: null } },
      select: { photo: true, avatarFileId: true },
    });

    try {
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
      return { id: created.id, isNew: true, needsAvatar: !created.photo };
    } catch (err) {
      const raced =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
          ? await this.findHarvested(departmentId, telegramId)
          : null;
      if (!raced) throw err;
      await this.touch(raced, fullName, telegramTag);
      return { id: raced.id, isNew: false, needsAvatar: false };
    }
  }

  private findHarvested(departmentId: string, telegramId: bigint) {
    return this.prisma.projectParticipant.findUnique({
      where: { departmentId_telegramId: { departmentId, telegramId } },
      select: { id: true, source: true },
    });
  }

  private touch(
    row: { id: string; source: ProjectParticipantSource },
    fullName: string,
    telegramTag: string | null,
  ) {
    return this.prisma.projectParticipant.update({
      where: { id: row.id },
      data:
        row.source === ProjectParticipantSource.MANUAL
          ? { lastSeenAt: new Date() }
          : { fullName, telegramTag, lastSeenAt: new Date() },
    });
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

  /**
   * Remove or hide a participant when they leave or are kicked from a chat.
   * HARVESTED entries are deleted; MANUAL entries are hidden to preserve admin edits.
   */
  async removeOrHideFromTelegram(
    departmentId: string,
    telegramId: bigint,
  ): Promise<{ action: 'deleted' | 'hidden' | 'none' }> {
    const existing = await this.prisma.projectParticipant.findFirst({
      where: { departmentId, telegramId },
      select: { id: true, source: true, hidden: true },
    });
    if (!existing) return { action: 'none' };

    if (existing.source === ProjectParticipantSource.HARVESTED) {
      await this.prisma.projectParticipant.delete({
        where: { id: existing.id },
      });
      return { action: 'deleted' };
    } else {
      if (!existing.hidden) {
        await this.prisma.projectParticipant.update({
          where: { id: existing.id },
          data: { hidden: true },
        });
        return { action: 'hidden' };
      }
      return { action: 'none' };
    }
  }

  /**
   * Fetch all participants with known Telegram IDs for chat membership verification.
   */
  findWithTelegramId(departmentId?: string) {
    return this.prisma.projectParticipant.findMany({
      where: {
        telegramId: { not: null },
        ...(departmentId ? { departmentId } : {}),
      },
      select: {
        id: true,
        departmentId: true,
        telegramId: true,
        fullName: true,
        source: true,
        hidden: true,
      },
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
      select: { fullName: true, photo: true },
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
