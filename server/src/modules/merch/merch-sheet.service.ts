import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { errorMessage } from '../../common/log-safe';
import { PrismaService } from '../../database/prisma.service';
import { GoogleSheetsService } from '../applicant/google-sheets.service';
import { ordersTable } from './merch-texts';

const API = 'https://sheets.googleapis.com/v4/spreadsheets';
const TICK_MS = 30_000;
const PAUSE_AFTER_ERROR_MS = 5 * 60_000;

/**
 * Optional mirror of the orders into the first tab of one spreadsheet, on when
 * GOOGLE_MERCH_SPREADSHEET_ID is set and the site's service account has edit
 * access. Queued by nature: a timer, never inside a handler, no row search.
 */
// ponytail: whole table rewritten when dirty; fine up to tens of thousands of
// rows. Manual sorting inside A to H is reset.
// ponytail: once the table fills the tab's grid, the tail clear may refuse a range
// below it: the rows are written and the next try comes in 5 min. Check the grid
// size first if that gets noisy.
@Injectable()
export class MerchSheetService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MerchSheetService.name);
  private timer?: NodeJS.Timeout;
  private seen = ''; // a restart rewrites once
  private tab?: string;
  private ticking = false;
  private pausedUntil = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogleSheetsService,
    private readonly config: ConfigService,
  ) {}

  private get spreadsheetId(): string {
    return this.config.get<string>('GOOGLE_MERCH_SPREADSHEET_ID')?.trim() ?? '';
  }

  onModuleInit() {
    if (!this.spreadsheetId) return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.ticking || Date.now() < this.pausedUntil) return;
    this.ticking = true;
    try {
      const stamp = await this.prisma.merchOrder.aggregate({
        _count: true,
        _max: { updatedAt: true },
      });
      const key = `${stamp._count}:${stamp._max.updatedAt?.getTime()}`;
      if (key === this.seen) return; // one cheap query per tick when nothing changed
      const orders = await this.prisma.merchOrder.findMany({
        orderBy: { id: 'asc' },
        include: { items: true },
      });
      const table = ordersTable(orders);
      const token = await this.google.getAccessToken();
      this.tab ??= await this.firstTab(token); // so the old sheet needs no rename
      const quoted = encodeURIComponent(`'${this.tab.replace(/'/g, "''")}'`);
      // RAW: a customer-typed "=..." is never evaluated.
      await this.call(
        token,
        'PUT',
        `/values/${quoted}!A1?valueInputOption=RAW`,
        { values: table },
      );
      await this.call(
        token,
        'POST',
        `/values/${quoted}!A${table.length + 1}:H:clear`,
        {},
      );
      this.seen = key;
    } catch (err) {
      this.pausedUntil = Date.now() + PAUSE_AFTER_ERROR_MS;
      this.tab = undefined; // it may have been renamed, so the next try reads it again
      this.logger.warn(
        'Merch sheet sync failed, next try in 5 min: ' + errorMessage(err),
      );
    } finally {
      this.ticking = false;
    }
  }

  private async firstTab(token: string): Promise<string> {
    const { sheets } = await this.call<{
      sheets: { properties: { title: string } }[];
    }>(token, 'GET', '?fields=sheets.properties.title');
    return sheets[0].properties.title;
  }

  private async call<T>(
    token: string,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${API}/${this.spreadsheetId}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      throw new Error(
        `Google Sheets ${res.status}: ${(await res.text()).slice(0, 300)}`,
      );
    }
    return (await res.json()) as T;
  }
}
