import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { GoogleSheetsService } from '../applicant/google-sheets.service';
import {
  RegistrationSheetsService,
  sheetIdFor,
  tabRequests,
} from './registration-sheets.service';
import {
  RegistrationTableEvent,
  registrationTable,
} from './registration-table';

const EVENT_ID = '7cbc7288-1111-4222-8333-444455556666';

function registration(
  over: Partial<RegistrationTableEvent['registrations'][number]> = {},
): RegistrationTableEvent['registrations'][number] {
  return {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    eventId: EVENT_ID,
    botUserId: null,
    telegramUserId: null,
    fullName: 'Шевченко Тарас',
    telegramTag: '@taras',
    group: 'ІП-31',
    birthDate: new Date('2007-03-05T00:00:00Z'),
    phoneNumber: '+380991234567',
    source: 'WEB',
    payment: 'DONATED',
    paymentStatus: 'REJECTED',
    paymentRejectionReason: 'Не та сума',
    ticketCode: '7cbc7288-aaaa-4bbb-8ccc-dddddddddddd',
    receiptUrl: '/uploads/receipt.jpg',
    attended: true,
    attendedAt: new Date('2026-10-25T14:05:00Z'),
    attendedBy: '@scanner',
    createdAt: new Date('2026-10-20T09:30:00Z'),
    answers: [
      { questionId: 'q2', value: 'Так' },
      { questionId: 'q1', value: 'Вампір' },
    ],
    ...over,
  };
}

const event = (regs = [registration()]) => ({
  id: EVENT_ID,
  name: 'FICEween 2026',
  date: new Date('2026-10-25T13:00:00Z'),
  questions: [
    { id: 'q1', label: 'Костюм' },
    { id: 'q2', label: 'Буду на афтепаті' },
  ],
  registrations: regs,
});

describe('registrationTable', () => {
  it('formats a registration the way organizers read it', () => {
    const [header, row] = registrationTable(event(), 'https://fice-sc.kpi.ua/');
    expect(header).toHaveLength(16);
    expect(header.slice(14)).toEqual(['Костюм', 'Буду на афтепаті']);
    expect(row[3]).toBe('05.03.2007');
    expect(row[7]).toBe('Відхилено: Не та сума');
    expect(row[8]).toBe('https://fice-sc.kpi.ua/uploads/receipt.jpg');
    expect(row[9]).toBe('7CBC7288');
    // Kyiv time: summer time on 20 Oct, winter time from 25 Oct.
    expect(row[10]).toContain('20.10.2026');
    expect(row[10]).toContain('12:30');
    expect(row[11]).toBe('Присутній');
    expect(row[12]).toContain('16:05');
    expect(row.slice(14)).toEqual(['Вампір', 'Так']);
  });
});

describe('tabRequests', () => {
  const table = registrationTable(event(), 'https://fice-sc.kpi.ua');

  it('creates a frozen-header tab under a free title and writes links', () => {
    const titles = new Set(['FICEween 2026 (25.10.2026)']);
    const requests = JSON.parse(
      JSON.stringify(tabRequests(event(), table, undefined, titles)),
    );
    expect(requests[0].addSheet.properties).toEqual({
      sheetId: sheetIdFor(EVENT_ID),
      title: 'FICEween 2026 (25.10.2026) #7cbc',
      gridProperties: {
        rowCount: 1000,
        columnCount: 26,
        frozenRowCount: 1,
        frozenColumnCount: 1,
      },
    });
    const [clear, write] = requests.filter((r: any) => r.updateCells);
    expect(clear.updateCells.range).toEqual({
      sheetId: sheetIdFor(EVENT_ID),
      startColumnIndex: 0,
      endColumnIndex: 16,
    });
    const [head, first] = write.updateCells.rows;
    expect(head.values[0]).toEqual({
      userEnteredValue: { stringValue: 'ПІБ' },
      userEnteredFormat: {
        textFormat: {
          bold: true,
          foregroundColor: { red: 1, green: 1, blue: 1 },
        },
      },
    });
    expect(first.values[0]).toEqual({
      userEnteredValue: { stringValue: 'Шевченко Тарас' },
    });
    expect(first.values[8].userEnteredFormat.textFormat.link).toEqual({
      uri: 'https://fice-sc.kpi.ua/uploads/receipt.jpg',
    });
  });

  it('gives a new tab stripes, filters, the attendance dropdown and row colors', () => {
    const requests = tabRequests(event(), table, undefined, new Set());
    const find = (key: string) =>
      requests.filter((r) => key in r) as Record<string, any>[];

    expect(find('addBanding')).toHaveLength(1);
    expect(find('setBasicFilter')).toHaveLength(1);
    const [validation] = find('setDataValidation');
    // «Присутність» is the 12th column (L).
    expect(validation.setDataValidation.range).toMatchObject({
      startRowIndex: 1,
      startColumnIndex: 11,
      endColumnIndex: 12,
    });
    expect(validation.setDataValidation.rule.condition.values).toEqual([
      { userEnteredValue: 'Присутній' },
      { userEnteredValue: 'Очікується' },
    ]);
    const rules = find('addConditionalFormatRule').map(
      (r) => r.addConditionalFormatRule,
    );
    expect(rules.map((r) => r.index)).toEqual([0, 1, 2, 3]);
    expect(rules[3].rule.booleanRule.condition.values).toEqual([
      { userEnteredValue: '=$L2="Присутній"' },
    ]);
    const [protection] = find('addProtectedRange');
    expect(protection.addProtectedRange.protectedRange).toMatchObject({
      warningOnly: true,
      range: { startColumnIndex: 0, endColumnIndex: 16 },
    });
    // The looks go before the data, right after the tab is added.
    expect(Object.keys(requests[1])).toEqual(['addBanding']);
  });

  it('grows an existing tab instead of adding one', () => {
    const requests = tabRequests(
      event(),
      table,
      {
        sheetId: sheetIdFor(EVENT_ID),
        title: 'Перейменована',
        gridProperties: { rowCount: 1, columnCount: 3 },
      },
      new Set(),
    );
    expect(requests.slice(0, 2)).toEqual([
      {
        appendDimension: {
          sheetId: sheetIdFor(EVENT_ID),
          dimension: 'ROWS',
          length: 1,
        },
      },
      {
        appendDimension: {
          sheetId: sheetIdFor(EVENT_ID),
          dimension: 'COLUMNS',
          length: 13,
        },
      },
    ]);
    expect(requests).toHaveLength(4);
  });
});

describe('RegistrationSheetsService', () => {
  let data = [event()];
  const findMany = jest.fn(async () => data);
  const service = new RegistrationSheetsService(
    { event: { findMany } } as unknown as PrismaService,
    { getAccessToken: async () => 'token' } as unknown as GoogleSheetsService,
    {
      get: (key: string) =>
        ({
          GOOGLE_EVENTS_SPREADSHEET_ID: 'sheet-1',
          PUBLIC_WEB_URL: 'https://fice-sc.kpi.ua',
        })[key],
    } as unknown as ConfigService,
  );
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch').mockImplementation((async (
      _url: string,
      init?: RequestInit,
    ) => ({
      ok: true,
      json: async () => (init?.method === 'POST' ? {} : { sheets: [] }),
    })) as unknown as typeof fetch);
  });

  afterEach(() => jest.restoreAllMocks());

  it('copies everything first, then rewrites only changed tabs', async () => {
    await service.tick();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.requests[0].addSheet.properties.sheetId).toBe(
      sheetIdFor(EVENT_ID),
    );

    fetchMock.mockClear();
    await service.tick();
    expect(fetchMock).not.toHaveBeenCalled();
    // After the first pass only recent events are read.
    expect(findMany.mock.calls[1]).toEqual([
      expect.objectContaining({
        where: expect.objectContaining({ date: expect.anything() }),
      }),
    ]);

    data = [event([registration({ attended: false, attendedAt: null })])];
    await service.tick();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rewrites a tab on demand and links to it', async () => {
    await expect(service.syncEvent(EVENT_ID)).resolves.toEqual({
      url: `https://docs.google.com/spreadsheets/d/sheet-1/edit#gid=${sheetIdFor(EVENT_ID)}`,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
