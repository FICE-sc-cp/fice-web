import { createHash } from 'crypto';
import { unlink } from 'fs/promises';
import { resolve } from 'path';
import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { errorMessage } from '../common/log-safe';
import { PrismaService } from '../database/prisma.service';
import { UPLOAD_DIR, UPLOAD_URL_PREFIX } from './upload.constants';

export const PUBLIC_UPLOAD_DAILY_QUOTA_BYTES = 300 * 1024 * 1024;
export const UNREFERENCED_GRACE_MS = 24 * 60 * 60_000;
const GC_INTERVAL_MS = 60 * 60_000;
const GC_FIRST_RUN_MS = 2 * 60_000;
const GC_BATCH = 500;

export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

@Injectable()
export class PublicUploadService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PublicUploadService.name);
  private timer?: NodeJS.Timeout;
  private firstRun?: NodeJS.Timeout;
  private collecting = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.firstRun = setTimeout(() => void this.tick(), GC_FIRST_RUN_MS);
    this.timer = setInterval(() => void this.tick(), GC_INTERVAL_MS);
    this.firstRun.unref?.();
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.firstRun) clearTimeout(this.firstRun);
    if (this.timer) clearInterval(this.timer);
  }

  async assertQuota(
    ipHash: string,
    incomingBytes: number,
    now: Date = new Date(),
  ): Promise<void> {
    const used = await this.prisma.publicUpload.aggregate({
      _sum: { size: true },
      where: {
        ipHash,
        createdAt: { gt: new Date(now.getTime() - UNREFERENCED_GRACE_MS) },
      },
    });
    if (
      (used._sum.size ?? 0) + incomingBytes >
      PUBLIC_UPLOAD_DAILY_QUOTA_BYTES
    ) {
      throw new HttpException(
        'Перевищено денний ліміт завантажень з вашої мережі. Спробуйте завтра або зверніться до організаторів.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async record(filename: string, size: number, ipHash: string) {
    const now = new Date();
    await this.prisma.publicUpload.create({
      data: {
        filename,
        size,
        ipHash,
        createdAt: now,
        unreferencedSince: now,
      },
    });
  }

  async collectGarbage(now: Date = new Date()) {
    const result = { deleted: 0, referenced: 0, waiting: 0 };
    let cursor: string | undefined;
    for (;;) {
      const batch = await this.prisma.publicUpload.findMany({
        orderBy: { id: 'asc' },
        take: GC_BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (batch.length === 0) break;
      cursor = batch[batch.length - 1].id;

      const urls = batch.map((u) => `${UPLOAD_URL_PREFIX}/${u.filename}`);
      const referenced = await this.referencedUrls(urls, now);

      for (const upload of batch) {
        const url = `${UPLOAD_URL_PREFIX}/${upload.filename}`;
        if (referenced.has(url)) {
          result.referenced++;
          if (upload.unreferencedSince) {
            await this.prisma.publicUpload.update({
              where: { id: upload.id },
              data: { unreferencedSince: null },
            });
          }
          continue;
        }
        if (!upload.unreferencedSince) {
          result.waiting++;
          await this.prisma.publicUpload.update({
            where: { id: upload.id },
            data: { unreferencedSince: now },
          });
          continue;
        }
        if (
          now.getTime() - upload.unreferencedSince.getTime() <
          UNREFERENCED_GRACE_MS
        ) {
          result.waiting++;
          continue;
        }
        await this.deleteFile(upload.filename);
        await this.prisma.publicUpload.delete({ where: { id: upload.id } });
        result.deleted++;
      }
      if (batch.length < GC_BATCH) break;
    }
    return result;
  }

  private async referencedUrls(
    urls: string[],
    now: Date,
  ): Promise<Set<string>> {
    if (urls.length === 0) return new Set();
    const rows = await this.prisma.$queryRaw<{ url: string }[]>(Prisma.sql`
      SELECT url FROM (
        SELECT "receiptUrl" AS url FROM "EventRegistration" WHERE "receiptUrl" = ANY(${urls})
        UNION SELECT "photoUrl" FROM "VotingCandidate" WHERE "photoUrl" = ANY(${urls})
        UNION SELECT "payload"->>'receiptUrl' FROM "PendingWebRegistration"
          WHERE "completed" = false AND "expiresAt" > ${now}
            AND "payload"->>'receiptUrl' = ANY(${urls})
        UNION SELECT "image" FROM "News" WHERE "image" = ANY(${urls})
        UNION SELECT "imageUrl" FROM "Fundraiser" WHERE "imageUrl" = ANY(${urls})
        UNION SELECT "photo" FROM "DepartmentHead" WHERE "photo" = ANY(${urls})
        UNION SELECT "photo" FROM "DepartmentMember" WHERE "photo" = ANY(${urls})
        UNION SELECT "photoUrl" FROM "Event" WHERE "photoUrl" = ANY(${urls})
        UNION SELECT "logoImage" FROM "Partner" WHERE "logoImage" = ANY(${urls})
        UNION SELECT "logoImage" FROM "EventPartner" WHERE "logoImage" = ANY(${urls})
        UNION SELECT "photo" FROM "ProjectParticipant" WHERE "photo" = ANY(${urls})
        UNION SELECT "imageUrl" FROM "BroadcastMessage" WHERE "imageUrl" = ANY(${urls})
      ) refs
    `);
    return new Set(rows.map((r) => r.url));
  }

  private async deleteFile(filename: string) {
    try {
      await unlink(resolve(UPLOAD_DIR, filename));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  private async tick() {
    if (this.collecting) return;
    this.collecting = true;
    try {
      const result = await this.collectGarbage();
      if (result.deleted > 0) {
        this.logger.log(
          `Removed ${result.deleted} unreferenced public upload(s).`,
        );
      }
    } catch (err) {
      this.logger.warn('Public upload cleanup failed: ' + errorMessage(err));
    } finally {
      this.collecting = false;
    }
  }
}
