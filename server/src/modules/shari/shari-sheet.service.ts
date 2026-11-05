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

const API = 'https://sheets.googleapis.com/v4/spreadsheets';
const TICK_MS = 30_000;
const PAUSE_AFTER_ERROR_MS = 5 * 60_000;

/** Rows for the sheet: header, then teachers by name. */
export function teacherLinksTable(
  teachers: { fullName: string; token: string }[],
  webUrl: string,
): string[][] {
  return [
    ['ПІБ', 'Особисте посилання'],
    ...[...teachers]
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'uk'))
      .map((t) => [t.fullName, `${webUrl}/shari/t/${t.token}`]),
  ];
}

/**
 * Teacher names and personal links mirrored into the first tab of one
 * spreadsheet, on when GOOGLE_SHARI_SPREADSHEET_ID is set and the service
 * account can edit it. The links are logins: keep that file private.
 */
// ponytail: whole table rewritten when it changes; fine for hundreds of teachers.
@Injectable()
export class ShariSheetService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ShariSheetService.name);
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
    return this.config.get<string>('GOOGLE_SHARI_SPREADSHEET_ID')?.trim() ?? '';
  }

  private webUrl(): string {
    return (
      this.config.get<string>('PUBLIC_WEB_URL')?.trim() ||
      'https://fice-sc.kpi.ua'
    ).replace(/\/$/, '');
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
      const teachers = await this.prisma.shariTeacher.findMany({
        select: { fullName: true, token: true },
      });
      const table = teacherLinksTable(teachers, this.webUrl());
      const key = JSON.stringify(table);
      if (key === this.seen) return;
      const token = await this.google.getAccessToken();
      this.tab ??= await this.firstTab(token);
      const quoted = encodeURIComponent(`'${this.tab.replace(/'/g, "''")}'`);
      // RAW: a name starting with "=" is never evaluated.
      await this.call(
        token,
        'PUT',
        `/values/${quoted}!A1?valueInputOption=RAW`,
        { values: table },
      );
      await this.call(
        token,
        'POST',
        `/values/${quoted}!A${table.length + 1}:B:clear`,
        {},
      );
      this.seen = key;
    } catch (err) {
      this.pausedUntil = Date.now() + PAUSE_AFTER_ERROR_MS;
      this.tab = undefined;
      this.logger.warn(
        'Shari sheet sync failed, next try in 5 min: ' + errorMessage(err),
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
