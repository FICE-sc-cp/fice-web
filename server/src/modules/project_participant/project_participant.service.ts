import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, ProjectParticipantSource } from '@prisma/client';
import { randomUUID } from 'crypto';
import { unlink, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { PrismaService } from '../../database/prisma.service';
import {
  ADMIN_IMAGE_PROFILE,
  reencodeImage,
} from '../../upload/image-processing';
import { UPLOAD_DIR, UPLOAD_URL_PREFIX } from '../../upload/upload.constants';
import {
  ArchivePerson,
  CONFIG_FORMAT,
  normalizePersonName,
  PeopleArchive,
} from './people-import';
import { CreateProjectParticipantDto } from './dto/create-project-participant.dto';
import { UpdateProjectParticipantDto } from './dto/update-project-participant.dto';

const FULL_NAME_MAX = 120;

export interface TelegramUserLike {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface PeopleImportSummary {
  added: number;
  updated: number;
  skipped: number;
  skippedByTool: { bots: number; deleted: number };
  unknownDepartments: number;
  possibleDuplicates: { department: string; fullName: string }[];
}

type StoreAvatar = (avatar: Buffer) => Promise<string | null>;

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

  // ---- Bulk import from the export tool ----------------------------------

  async exportConfig() {
    const departments = await this.prisma.department.findMany({
      where: { telegramChatId: { not: null } },
      select: { id: true, name: true, telegramChatId: true },
      orderBy: { name: 'asc' },
    });
    return {
      format: CONFIG_FORMAT,
      createdAt: new Date().toISOString(),
      departments: departments.map((d) => ({
        departmentId: d.id,
        name: d.name,
        chat: d.telegramChatId,
      })),
    };
  }

  async importPeople(
    archive: PeopleArchive,
    storeAvatar: StoreAvatar = (avatar) => this.storeAvatar(avatar),
  ): Promise<PeopleImportSummary> {
    const summary: PeopleImportSummary = {
      added: 0,
      updated: 0,
      skipped: archive.invalid,
      skippedByTool: archive.skippedByTool,
      unknownDepartments: 0,
      possibleDuplicates: [],
    };
    const known = await this.prisma.department.findMany({
      where: { id: { in: archive.departments.map((d) => d.departmentId) } },
      select: { id: true, name: true },
    });
    const names = new Map(known.map((d) => [d.id, d.name]));

    for (const dept of archive.departments) {
      const deptName = names.get(dept.departmentId);
      if (!deptName) {
        summary.unknownDepartments += 1;
        summary.skipped += dept.people.length;
        continue;
      }
      const manual = await this.prisma.projectParticipant.findMany({
        where: { departmentId: dept.departmentId, telegramId: null },
        select: { fullName: true },
      });
      const manualNames = new Set(
        manual.map((m) => normalizePersonName(m.fullName)),
      );
      for (const person of dept.people) {
        const outcome = await this.importPerson(
          dept.departmentId,
          person,
          manualNames,
          storeAvatar,
        );
        if (outcome === 'duplicate') {
          summary.skipped += 1;
          summary.possibleDuplicates.push({
            department: deptName,
            fullName: person.fullName,
          });
        } else {
          summary[outcome] += 1;
        }
      }
    }
    return summary;
  }

  private async importPerson(
    departmentId: string,
    person: ArchivePerson,
    manualNames: Set<string>,
    storeAvatar: StoreAvatar,
  ): Promise<'added' | 'updated' | 'duplicate'> {
    const existing = await this.findImported(departmentId, person.telegramId);
    if (existing) {
      await this.refreshImported(existing, person, storeAvatar);
      return 'updated';
    }
    if (manualNames.has(normalizePersonName(person.fullName))) {
      return 'duplicate';
    }

    const twin = await this.prisma.projectParticipant.findFirst({
      where: { telegramId: person.telegramId, photo: { not: null } },
      select: { photo: true, avatarFileId: true },
    });
    const photo =
      twin?.photo ?? (person.avatar ? await storeAvatar(person.avatar) : null);
    try {
      await this.prisma.projectParticipant.create({
        data: {
          telegramId: person.telegramId,
          fullName: person.fullName,
          departmentId,
          photo,
          avatarFileId: twin?.avatarFileId ?? null,
          source: ProjectParticipantSource.HARVESTED,
        },
        select: { id: true },
      });
      return 'added';
    } catch (err) {
      const raced =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
          ? await this.findImported(departmentId, person.telegramId)
          : null;
      if (!raced) throw err;
      await this.refreshImported(raced, person, storeAvatar);
      return 'updated';
    }
  }

  private findImported(departmentId: string, telegramId: bigint) {
    return this.prisma.projectParticipant.findUnique({
      where: { departmentId_telegramId: { departmentId, telegramId } },
      select: { id: true, source: true, photo: true },
    });
  }

  private async refreshImported(
    row: { id: string; source: ProjectParticipantSource; photo: string | null },
    person: ArchivePerson,
    storeAvatar: StoreAvatar,
  ) {
    const photo =
      !row.photo && person.avatar ? await storeAvatar(person.avatar) : null;
    await this.prisma.projectParticipant.update({
      where: { id: row.id },
      data: {
        lastSeenAt: new Date(),
        ...(row.source === ProjectParticipantSource.HARVESTED
          ? { fullName: person.fullName }
          : {}),
        ...(photo ? { photo } : {}),
      },
    });
  }

  private async storeAvatar(avatar: Buffer): Promise<string | null> {
    const filename = `${randomUUID()}.jpg`;
    const path = resolve(UPLOAD_DIR, filename);
    try {
      await writeFile(path, avatar);
      await reencodeImage(path, '.jpg', ADMIN_IMAGE_PROFILE);
      return `${UPLOAD_URL_PREFIX}/${filename}`;
    } catch (err) {
      await unlink(path).catch(() => undefined);
      this.logger.warn(
        `Skipped an imported avatar: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
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
