import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { GoogleSheetsService } from '../applicant/google-sheets.service';
import {
  EXPECTED,
  PRESENT,
  RegistrationTableEvent,
  registrationTable,
} from './registration-table';

const API = 'https://sheets.googleapis.com/v4/spreadsheets';
export const TICK_MS = 30_000;
// After the first full pass only events of the last week are re-read each
// tick; older tabs are rewritten at the next start or from the admin button.
const RECENT_MS = 7 * 24 * 60 * 60_000;
const PAUSE_AFTER_ERROR_MS = 5 * 60_000;
// Who the check-in list shows for attendance set in the sheet.
const SHEET_EDITOR = 'Google Таблиця';
// Keeps each batchUpdate far below Google's request size limit.
const CELLS_PER_CALL = 50_000;
const FIELDS =
  'userEnteredValue,userEnteredFormat.textFormat,userEnteredFormat.backgroundColor';

const eventDay = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Europe/Kyiv',
});

type SheetEvent = RegistrationTableEvent & {
  id: string;
  name: string;
  date: Date;
};

export interface SheetProperties {
  sheetId: number;
  title: string;
  gridProperties?: { rowCount?: number; columnCount?: number };
}

/** The tab id comes from the event id, so a renamed event keeps its tab. */
export function sheetIdFor(eventId: string): number {
  return parseInt(eventId.replace(/-/g, '').slice(0, 7), 16) + 1;
}

const rgb = (hex: string) => ({
  red: parseInt(hex.slice(1, 3), 16) / 255,
  green: parseInt(hex.slice(3, 5), 16) / 255,
  blue: parseInt(hex.slice(5, 7), 16) / 255,
});
// The site's violet over white and lavender stripes; a present guest's row turns mint.
const WHITE = rgb('#ffffff');
const VIOLET = rgb('#9810fa');
const LAVENDER = rgb('#f6f0ff');
const MINT = rgb('#d3f8e2');
const GREEN = rgb('#0b8043');
const AMBER = rgb('#8a5a00');
const AMBER_BG = rgb('#fff4ce');
const RED = rgb('#d93025');

// Pixel widths of the base columns; question columns get 200.
const WIDTH: Record<string, number> = {
  ПІБ: 200,
  Telegram: 150,
  Група: 80,
  'Дата народження': 120,
  Телефон: 130,
  Джерело: 120,
  Оплата: 100,
  'Статус оплати': 190,
  'Скрін/Чек': 200,
  'Код квитка': 100,
  Зареєстровано: 140,
  Присутність: 120,
  'Час відмітки': 140,
  'Хто відмітив': 140,
};

function cell(value: string, header: boolean) {
  const link = /^https?:\/\//.test(value) ? { uri: value } : undefined;
  // The header paints its own violet: white text must stay readable even on
  // a tab that has not got the looks yet.
  const format = header
    ? {
        backgroundColor: VIOLET,
        textFormat: { bold: true, foregroundColor: WHITE },
      }
    : link && { textFormat: { link } };
  return {
    userEnteredValue: { stringValue: value },
    ...(format ? { userEnteredFormat: format } : {}),
  };
}

/**
 * The looks a tab gets once: frozen header and names, stripes, filter
 * buttons, column widths, an attendance dropdown that colors the whole row,
 * colored payment statuses and a warning that edits here get overwritten.
 */
export function styleRequests(
  sheetId: number,
  header: string[],
  rows: number,
  columns: number,
): object[] {
  const grid = {
    sheetId,
    startRowIndex: 0,
    endRowIndex: rows,
    startColumnIndex: 0,
    endColumnIndex: columns,
  };
  const body = { ...grid, startRowIndex: 1 };
  const present = header.indexOf('Присутність');
  const payment = header.indexOf('Статус оплати');
  const status = {
    ...body,
    startColumnIndex: payment,
    endColumnIndex: payment + 1,
  };
  const rule = (
    index: number,
    range: object,
    type: string,
    value: string,
    format: object,
  ) => ({
    addConditionalFormatRule: {
      index,
      rule: {
        ranges: [range],
        booleanRule: {
          condition: { type, values: [{ userEnteredValue: value }] },
          format,
        },
      },
    },
  });
  return [
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 1, frozenColumnCount: 1 },
        },
        fields:
          'gridProperties.frozenRowCount,gridProperties.frozenColumnCount',
      },
    },
    {
      addBanding: {
        bandedRange: {
          range: grid,
          rowProperties: {
            headerColor: VIOLET,
            firstBandColor: WHITE,
            secondBandColor: LAVENDER,
          },
        },
      },
    },
    { setBasicFilter: { filter: { range: grid } } },
    {
      setDataValidation: {
        range: {
          ...body,
          startColumnIndex: present,
          endColumnIndex: present + 1,
        },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: PRESENT },
              { userEnteredValue: EXPECTED },
            ],
          },
          showCustomUi: true,
          strict: true,
        },
      },
    },
    // Only the first matching rule colors a cell, so the payment status keeps
    // its color inside a present guest's mint row.
    rule(0, status, 'TEXT_EQ', 'Підтверджено', {
      textFormat: { bold: true, foregroundColor: GREEN },
    }),
    rule(1, status, 'TEXT_EQ', 'Очікує підтвердження', {
      backgroundColor: AMBER_BG,
      textFormat: { foregroundColor: AMBER },
    }),
    rule(2, status, 'TEXT_STARTS_WITH', 'Відхилено', {
      textFormat: { bold: true, foregroundColor: RED },
    }),
    rule(
      3,
      body,
      'CUSTOM_FORMULA',
      `=$${String.fromCharCode(65 + present)}2="${PRESENT}"`,
      { backgroundColor: MINT },
    ),
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 36 },
        fields: 'pixelSize',
      },
    },
    ...header.map((title, i) => ({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: i,
          endIndex: i + 1,
        },
        properties: { pixelSize: WIDTH[title] ?? 200 },
        fields: 'pixelSize',
      },
    })),
    // Everything the site fills except attendance, which organizers may set.
    ...[
      [0, present],
      [present + 1, header.length],
    ].map(([start, end]) => ({
      addProtectedRange: {
        protectedRange: {
          range: { ...grid, startColumnIndex: start, endColumnIndex: end },
          description:
            'Ці колонки заповнює сайт, правки тут перезапишуться. Змінювати можна лише «Присутність».',
          warningOnly: true,
        },
      },
    })),
  ];
}

/** Ticket number → attendance cell of a written table. */
function attendanceOf(table: string[][]): Map<string, string> {
  const [header, ...rows] = table;
  const code = header.indexOf('Код квитка');
  const present = header.indexOf('Присутність');
  return new Map(rows.map((row) => [row[code], row[present]]));
}

/**
 * batchUpdate requests that leave `table` in the first columns of the
 * event's tab, creating the tab or growing its grid when needed.
 */
export function tabRequests(
  event: { id: string; name: string; date: Date },
  table: string[][],
  sheet: SheetProperties | undefined,
  titles: Set<string>,
): object[] {
  const sheetId = sheetIdFor(event.id);
  const width = table[0].length;
  const requests: object[] = [];
  if (!sheet) {
    let title = `${event.name} (${eventDay.format(event.date)})`;
    if (titles.has(title)) title += ` #${event.id.slice(0, 4)}`;
    titles.add(title);
    requests.push({
      addSheet: {
        properties: {
          sheetId,
          title,
          gridProperties: {
            rowCount: Math.max(1000, table.length),
            columnCount: Math.max(26, width),
            frozenRowCount: 1,
          },
        },
      },
    });
  } else {
    const rows = sheet.gridProperties?.rowCount ?? 0;
    const columns = sheet.gridProperties?.columnCount ?? 0;
    if (rows < table.length) {
      requests.push({
        appendDimension: {
          sheetId,
          dimension: 'ROWS',
          length: table.length - rows,
        },
      });
    }
    if (columns < width) {
      requests.push({
        appendDimension: {
          sheetId,
          dimension: 'COLUMNS',
          length: width - columns,
        },
      });
    }
  }
  requests.push(
    // Wipes what the last write left in these columns, e.g. a deleted registration.
    {
      updateCells: {
        range: { sheetId, startColumnIndex: 0, endColumnIndex: width },
        fields: FIELDS,
      },
    },
    {
      updateCells: {
        start: { sheetId, rowIndex: 0, columnIndex: 0 },
        rows: table.map((row, i) => ({
          values: row.map((value) => cell(value, i === 0)),
        })),
        fields: FIELDS,
      },
    },
  );
  return requests;
}

/**
 * Mirrors registrations into one Google spreadsheet, a tab per event. The
 * first pass after a start copies every event; then changed tabs are
 * rewritten every 30 s, and attendance flipped in the sheet goes back to
 * the site first. Needs GOOGLE_EVENTS_SPREADSHEET_ID and the service
 * account of the join applications sheet, with edit access to the file.
 */
@Injectable()
export class RegistrationSheetsService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RegistrationSheetsService.name);
  private timer?: NodeJS.Timeout;
  private queue: Promise<unknown> = Promise.resolve();
  private ticking = false;
  private backfilled = false;
  private pausedUntil = 0;
  // Hash of the table each tab got last, so unchanged tabs are skipped.
  private readonly written = new Map<string, string>();
  // Tabs this process already tried to style; a failed try waits for a restart.
  private readonly styled = new Set<number>();
  // Attendance cells as last written, by event and ticket number: a cell
  // that differs was changed by a person, not by a scan made since.
  private readonly attendance = new Map<string, Map<string, string>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogleSheetsService,
    private readonly config: ConfigService,
  ) {}

  private get spreadsheetId(): string {
    return (
      this.config.get<string>('GOOGLE_EVENTS_SPREADSHEET_ID')?.trim() ?? ''
    );
  }

  onModuleInit() {
    if (!this.spreadsheetId) return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.logger.log(
      'Registrations are copied to Google Sheets, a tab per event.',
    );
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.ticking || Date.now() < this.pausedUntil) return;
    this.ticking = true;
    try {
      await this.exclusive(async () => {
        const recent = this.backfilled
          ? { date: { gte: new Date(Date.now() - RECENT_MS) } }
          : {};
        const where = {
          ...recent,
          OR: [
            { registrations: { some: {} } },
            // A tab whose last registration was deleted still needs clearing.
            { id: { in: [...this.written.keys()] } },
          ],
        };
        let events = await this.load(where);
        if (await this.pullAttendance(events)) events = await this.load(where);
        await this.write(events, false);
        this.backfilled = true;
      });
    } catch (err) {
      this.pausedUntil = Date.now() + PAUSE_AFTER_ERROR_MS;
      this.logger.warn(
        `Google Sheets sync failed, next try in 5 min: ${errorText(err)}`,
      );
    } finally {
      this.ticking = false;
    }
  }

  /** Rewrites one event's tab now and links to it (the admin button). */
  async syncEvent(eventId: string): Promise<{ url: string }> {
    if (!this.spreadsheetId) {
      throw new BadRequestException(
        'Google Таблицю для реєстрацій не підключено: на сервері не задано GOOGLE_EVENTS_SPREADSHEET_ID.',
      );
    }
    const found = await this.exclusive(async () => {
      let events = await this.load({ id: eventId });
      try {
        if (await this.pullAttendance(events)) {
          events = await this.load({ id: eventId });
        }
        await this.write(events, true);
      } catch (err) {
        throw new BadGatewayException(
          `Google Таблиця не прийняла дані: ${errorText(err)}`,
        );
      }
      return events.length > 0;
    });
    if (!found) throw new NotFoundException(`Event ${eventId} not found`);
    this.pausedUntil = 0;
    return {
      url: `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit#gid=${sheetIdFor(eventId)}`,
    };
  }

  private load(where: Prisma.EventWhereInput): Promise<SheetEvent[]> {
    return this.prisma.event.findMany({
      where,
      orderBy: { date: 'asc' },
      include: {
        questions: { orderBy: { order: 'asc' } },
        registrations: {
          include: { answers: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  /**
   * Organizers may flip «Присутність» in the sheet. A cell that no longer
   * says what the sync wrote there is their edit and goes to the site like
   * a mark from the check-in list. Returns whether anything changed.
   */
  private async pullAttendance(events: SheetEvent[]): Promise<boolean> {
    const watched = events.filter((event) => this.attendance.has(event.id));
    if (!watched.length) return false;
    const [header] = registrationTable(watched[0]);
    const code = header.indexOf('Код квитка');
    const present = header.indexOf('Присутність');
    const token = await this.google.getAccessToken();
    const { valueRanges = [] } = await this.call<{
      valueRanges?: {
        valueRange?: { values?: string[][] };
        dataFilters?: { gridRange?: { sheetId?: number } }[];
      }[];
    }>(token, '/values:batchGetByDataFilter', {
      dataFilters: watched.map((event) => ({
        gridRange: {
          sheetId: sheetIdFor(event.id),
          startRowIndex: 1,
          startColumnIndex: code,
          endColumnIndex: present + 1,
        },
      })),
    });
    const cells = new Map(
      valueRanges.map((range) => [
        range.dataFilters?.[0]?.gridRange?.sheetId,
        range.valueRange?.values ?? [],
      ]),
    );

    let changed = false;
    for (const event of watched) {
      const written = this.attendance.get(event.id)!;
      const byTicket = new Map(
        event.registrations.map((reg) => [
          reg.ticketCode.slice(0, 8).toUpperCase(),
          reg,
        ]),
      );
      for (const row of cells.get(sheetIdFor(event.id)) ?? []) {
        const ticket = row[0];
        const value = row[present - code] ?? '';
        if (value !== PRESENT && value !== EXPECTED) continue;
        if (value === written.get(ticket)) continue;
        const reg = byTicket.get(ticket);
        const attended = value === PRESENT;
        if (reg && reg.attended !== attended) {
          await this.prisma.eventRegistration.update({
            where: { id: reg.id },
            data: {
              attended,
              attendedAt: attended ? new Date() : null,
              attendedBy: attended ? SHEET_EDITOR : null,
            },
          });
          this.logger.log(
            `Attendance from Google Sheets: ${reg.fullName} → ${value}`,
          );
          changed = true;
        }
        written.set(ticket, value);
      }
    }
    return changed;
  }

  private async write(events: SheetEvent[], force: boolean): Promise<void> {
    const webUrl = this.config.get<string>('PUBLIC_WEB_URL') ?? '';
    const tabs = events
      .map((event) => {
        const table = registrationTable(event, webUrl);
        const hash = createHash('sha1')
          .update(JSON.stringify(table))
          .digest('hex');
        return { event, table, hash };
      })
      .filter((tab) => force || this.written.get(tab.event.id) !== tab.hash);
    if (!tabs.length) return;

    const token = await this.google.getAccessToken();
    const { sheets = [] } = await this.call<{
      sheets?: { properties: SheetProperties; bandedRanges?: unknown[] }[];
    }>(
      token,
      '?fields=sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)),bandedRanges(bandedRangeId))',
    );
    const existing = new Map(
      sheets.map(({ properties }) => [properties.sheetId, properties]),
    );
    const titles = new Set(sheets.map(({ properties }) => properties.title));
    // Stripes mark a styled tab; tabs made before the looks existed have none.
    const striped = new Set(
      sheets
        .filter(({ bandedRanges }) => bandedRanges?.length)
        .map(({ properties }) => properties.sheetId),
    );

    let batch: typeof tabs = [];
    let cells = 0;
    const flush = async () => {
      if (!batch.length) return;
      const requests = batch.flatMap(({ event, table }) =>
        tabRequests(event, table, existing.get(sheetIdFor(event.id)), titles),
      );
      await this.call(token, ':batchUpdate', { requests });
      for (const { event, hash, table } of batch) {
        this.written.set(event.id, hash);
        this.attendance.set(event.id, attendanceOf(table));
      }
      batch = [];
      cells = 0;
    };
    for (const tab of tabs) {
      batch.push(tab);
      cells += tab.table.length * tab.table[0].length;
      if (cells >= CELLS_PER_CALL) await flush();
    }
    await flush();

    // The looks go in a call of their own, so a styling error never holds
    // the data back.
    const plain = tabs.filter(({ event }) => {
      const id = sheetIdFor(event.id);
      return !striped.has(id) && !this.styled.has(id);
    });
    if (!plain.length) return;
    const requests = plain.flatMap(({ event, table }) => {
      const id = sheetIdFor(event.id);
      this.styled.add(id);
      const grid = existing.get(id)?.gridProperties;
      return styleRequests(
        id,
        table[0],
        Math.max(grid?.rowCount ?? 1000, table.length),
        Math.max(grid?.columnCount ?? 26, table[0].length),
      );
    });
    await this.call(token, ':batchUpdate', { requests }).catch((err: unknown) =>
      this.logger.warn(
        `Could not style the Google Sheets tabs: ${errorText(err)}`,
      ),
    );
  }

  private async call<T>(
    token: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${API}/${this.spreadsheetId}${path}`, {
      method: body ? 'POST' : 'GET',
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

  private exclusive<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(job);
    this.queue = run.catch(() => undefined);
    return run;
  }
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
