import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { FundraiserService } from './fundraiser.service';

const MONO_API = 'https://api.monobank.ua';
// Monobank personal API allows at most one request per 60s per token.
const POLL_INTERVAL_MS = 60_000;
const STATEMENT_WINDOW_S = 24 * 60 * 60; // look back 24h for new donations

interface MonoJar {
  id: string;
  balance: number; // minor units (kopecks)
  goal?: number;
}

interface MonoStatementItem {
  id: string;
  time: number; // unix seconds
  description?: string;
  comment?: string;
  amount: number; // minor units, signed (positive = incoming)
}

/**
 * Optional background sync with Monobank jars. Disabled unless MONOBANK_TOKEN
 * is set. Because the personal API is rate-limited to one request per minute,
 * each tick performs a single request, cycling between "refresh all balances"
 * and "import one jar's recent statement".
 */
@Injectable()
export class MonobankService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonobankService.name);
  private timer?: NodeJS.Timeout;
  private cursor = 0;
  private get token(): string | undefined {
    return process.env.MONOBANK_TOKEN?.trim() || undefined;
  }

  constructor(private readonly fundraisers: FundraiserService) {}

  onModuleInit() {
    if (!this.token) {
      this.logger.log('MONOBANK_TOKEN not set — jar auto-sync disabled.');
      return;
    }
    this.logger.log('Monobank jar auto-sync enabled (60s interval).');
    this.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS);
    // Kick off shortly after boot so the first sync is not a minute away.
    setTimeout(() => void this.tick(), 5_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    try {
      const linked = await this.fundraisers.fundraisersWithJars();
      if (linked.length === 0) return;

      // Task 0 refreshes balances; tasks 1..N import each jar's statement.
      const taskCount = linked.length + 1;
      const task = this.cursor % taskCount;
      this.cursor = (this.cursor + 1) % taskCount;

      if (task === 0) {
        await this.refreshBalances(linked);
      } else {
        await this.importStatement(linked[task - 1]);
      }
    } catch (err) {
      this.logger.warn(`Monobank sync tick failed: ${this.msg(err)}`);
    }
  }

  private async refreshBalances(
    linked: { id: string; monoJarId: string | null }[],
  ) {
    const info = await this.fetch<{ jars?: MonoJar[] }>('/personal/client-info');
    const byId = new Map((info.jars ?? []).map((j) => [j.id, j]));
    for (const f of linked) {
      const jar = f.monoJarId ? byId.get(f.monoJarId) : undefined;
      if (jar) {
        await this.fundraisers.setBalance(f.id, jar.balance / 100);
      }
    }
  }

  private async importStatement(f: { id: string; monoJarId: string | null }) {
    if (!f.monoJarId) return;
    const from = Math.floor(Date.now() / 1000) - STATEMENT_WINDOW_S;
    const items = await this.fetch<MonoStatementItem[]>(
      `/personal/statement/${f.monoJarId}/${from}`,
    );
    for (const item of items ?? []) {
      if (item.amount <= 0) continue; // only incoming transfers
      await this.fundraisers.importMonoDonation(f.id, {
        externalId: item.id,
        name: item.description?.slice(0, 60) || null,
        amount: item.amount / 100,
        createdAt: new Date(item.time * 1000),
      });
    }
  }

  private async fetch<T>(path: string): Promise<T> {
    const res = await globalThis.fetch(`${MONO_API}${path}`, {
      headers: { 'X-Token': this.token ?? '' },
    });
    if (!res.ok) {
      throw new Error(`${path} -> ${res.status}`);
    }
    return (await res.json()) as T;
  }

  private msg(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
