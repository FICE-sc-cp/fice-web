import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { FundraiserStatus } from '@prisma/client';
import { BotService } from '../../bot/bot.service';
import { PrismaService } from '../../database/prisma.service';
import {
  JarSnapshot,
  MonobankJarClient,
  jarSnapshotData,
  parseJarWidget,
} from './monobank-jar.client';

export const TICK_MS = 60_000;
const FIRST_TICK_DELAY_MS = 15_000;
export const SYNC_EVERY_MS = 5 * 60_000;
const DUE_SLACK_MS = 10_000;
export const BACKOFF_START_MS = 5 * 60_000;
export const BACKOFF_MAX_MS = 30 * 60_000;
export const FAILURES_BEFORE_ALERT = 3;
const FORGET_AFTER_MS = 60 * 60_000;
const CANDIDATES = 50;

interface LinkedFundraiser {
  id: string;
  name: string;
  jarWidgetUrl: string;
}

@Injectable()
export class JarSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JarSyncService.name);
  private timer?: NodeJS.Timeout;
  private firstTick?: NodeJS.Timeout;
  private running = false;
  private pausedUntil = 0;
  private backoffMs = BACKOFF_START_MS;
  private rateLimitAlerted = false;
  private readonly lastAttempt = new Map<string, number>();
  private readonly failures = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: MonobankJarClient,
    private readonly bot: BotService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.firstTick = setTimeout(() => void this.tick(), FIRST_TICK_DELAY_MS);
    this.logger.log(
      'Monobank jar sync enabled (1 jar per minute, each jar every 5 min).',
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.firstTick) clearTimeout(this.firstTick);
  }

  async tick(): Promise<void> {
    const now = Date.now();
    if (this.running || now < this.pausedUntil) return;
    this.running = true;
    try {
      this.forgetStale(now);
      const fundraiser = await this.nextDue(now);
      if (fundraiser) await this.sync(fundraiser);
    } catch (err) {
      this.logger.error(`Jar sync tick failed: ${errorText(err)}`);
    } finally {
      this.running = false;
    }
  }

  private async nextDue(now: number): Promise<LinkedFundraiser | undefined> {
    const dueBefore = now - SYNC_EVERY_MS + DUE_SLACK_MS;
    const candidates = await this.prisma.fundraiser.findMany({
      where: {
        status: FundraiserStatus.ACTIVE,
        jarWidgetUrl: { not: null },
        jarSyncError: null,
        OR: [
          { jarSyncedAt: null },
          { jarSyncedAt: { lte: new Date(dueBefore) } },
        ],
      },
      select: { id: true, name: true, jarWidgetUrl: true },
      orderBy: { jarSyncedAt: { sort: 'asc', nulls: 'first' } },
      take: CANDIDATES,
    });
    for (const c of candidates) {
      if (!c.jarWidgetUrl) continue;
      if ((this.lastAttempt.get(c.id) ?? 0) > dueBefore) continue;
      return { id: c.id, name: c.name, jarWidgetUrl: c.jarWidgetUrl };
    }
    return undefined;
  }

  private async sync(f: LinkedFundraiser): Promise<void> {
    this.lastAttempt.set(f.id, Date.now());
    const link = parseJarWidget(f.jarWidgetUrl);
    if (!link) {
      await this.markBroken(f, 'некоректне посилання на віджет банки');
      return;
    }

    const result = await this.client.fetch(link.widgetId);
    switch (result.kind) {
      case 'ok':
        await this.apply(f, result.jar, link.sendId);
        return;
      case 'invalid':
        await this.markBroken(
          f,
          'банку не знайдено — її видалили або посилання на віджет змінилося',
        );
        return;
      case 'unsupported':
        await this.markBroken(f, result.reason);
        return;
      case 'rate-limited':
        await this.onRateLimited();
        return;
      case 'unavailable':
        await this.onUnavailable(f, result.reason);
        return;
    }
  }

  private async apply(
    f: LinkedFundraiser,
    jar: JarSnapshot,
    fallbackSendId: string | null,
  ): Promise<void> {
    const { count } = await this.prisma.fundraiser.updateMany({
      where: {
        id: f.id,
        jarWidgetUrl: f.jarWidgetUrl,
        status: FundraiserStatus.ACTIVE,
      },
      data: {
        ...jarSnapshotData(jar, fallbackSendId),
        ...(jar.closed && { status: FundraiserStatus.CLOSED }),
      },
    });

    this.backoffMs = BACKOFF_START_MS;
    this.rateLimitAlerted = false;
    const wasAlerted = (this.failures.get(f.id) ?? 0) >= FAILURES_BEFORE_ALERT;
    this.failures.delete(f.id);
    if (count === 0) return;

    if (wasAlerted) {
      await this.notify(
        `✅ Збір «${f.name}»: звʼязок з Monobank відновився, сума на сайті знову оновлюється.`,
      );
    }
    if (jar.closed) {
      await this.notify(
        `🏁 Збір «${f.name}»: власник закрив банку Monobank, тому збір автоматично позначено як завершений.`,
      );
    }
  }

  private async markBroken(f: LinkedFundraiser, reason: string): Promise<void> {
    this.failures.delete(f.id);
    const { count } = await this.prisma.fundraiser.updateMany({
      where: { id: f.id, jarWidgetUrl: f.jarWidgetUrl },
      data: { jarSyncError: reason.slice(0, 255) },
    });
    this.logger.warn(`Jar sync stopped for fundraiser ${f.id}: ${reason}`);
    if (count === 0) return;
    await this.notify(
      [
        `⚠️ Збір «${f.name}»: автооновлення суми з Monobank зупинено.`,
        `Причина: ${reason}.`,
        'Сайт показує останню відому суму. Виправ посилання на віджет в адмінці та збережи збір — оновлення відновиться.',
      ].join('\n'),
    );
  }

  private async onRateLimited(): Promise<void> {
    const pauseMs = this.backoffMs;
    this.pausedUntil = Date.now() + pauseMs;
    this.backoffMs = Math.min(pauseMs * 2, BACKOFF_MAX_MS);
    this.logger.warn(
      `Monobank rate limit hit, pausing jar sync for ${pauseMs / 60_000} min.`,
    );
    if (pauseMs >= BACKOFF_MAX_MS && !this.rateLimitAlerted) {
      this.rateLimitAlerted = true;
      await this.notify(
        [
          '⚠️ Monobank обмежує запити від нашого сервера (помилка 429).',
          'Суми зборів на сайті тимчасово не оновлюються. Сервер сам повторює спроби кожні 30 хв і відновить оновлення без втручання.',
        ].join('\n'),
      );
    }
  }

  private async onUnavailable(
    f: LinkedFundraiser,
    reason: string,
  ): Promise<void> {
    const count = (this.failures.get(f.id) ?? 0) + 1;
    this.failures.set(f.id, count);
    this.logger.warn(
      `Jar sync failed for fundraiser ${f.id} (${count} in a row): ${reason}`,
    );
    if (count !== FAILURES_BEFORE_ALERT) return;
    await this.notify(
      [
        `⚠️ Збір «${f.name}»: не вдається оновити суму з Monobank (${count} спроби поспіль).`,
        `Причина: ${reason}.`,
        'Сайт показує останню відому суму. Сервер продовжує пробувати кожні 5 хв і напише, коли все відновиться.',
      ].join('\n'),
    );
  }

  private forgetStale(now: number): void {
    for (const [id, at] of this.lastAttempt) {
      if (now - at < FORGET_AFTER_MS) continue;
      this.lastAttempt.delete(id);
      this.failures.delete(id);
    }
  }

  private async notify(text: string): Promise<void> {
    try {
      await this.bot.notifyGroup(text);
    } catch (err) {
      this.logger.warn(`Failed to notify admins: ${errorText(err)}`);
    }
  }
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
