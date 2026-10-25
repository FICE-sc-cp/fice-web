import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { GoogleSheetsService } from '../applicant/google-sheets.service';
import {
  RegistrationSheetsService,
  sheetIdFor,
  styleRequests,
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
      gridProperties: { rowCount: 1000, columnCount: 26, frozenRowCount: 1 },
    });
    // Only the data here: the looks go in a call of their own.
    expect(requests).toHaveLength(3);
    const [clear, write] = requests.filter((r: any) => r.updateCells);
    expect(clear.updateCells.range).toEqual({
      sheetId: sheetIdFor(EVENT_ID),
      startColumnIndex: 0,
      endColumnIndex: 16,
    });
    const [head, first] = write.updateCells.rows;
    // The header brings its own violet, so white text never lands on white.
    expect(head.values[0]).toEqual({
      userEnteredValue: { stringValue: 'ПІБ' },
      userEnteredFormat: {
        backgroundColor: { red: 152 / 255, green: 16 / 255, blue: 250 / 255 },
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

describe('styleRequests', () => {
  const [header] = registrationTable(event());

  it('freezes, stripes and filters the tab, with the attendance dropdown and row colors', () => {
    const requests = styleRequests(sheetIdFor(EVENT_ID), header, 1000, 26);
    const find = (key: string) =>
      requests.filter((r) => key in r) as Record<string, any>[];

    expect(Object.keys(requests[0])).toEqual(['updateSheetProperties']);
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
    expect(
      find('addProtectedRange').map((r) => {
        const { range, warningOnly } = r.addProtectedRange.protectedRange;
        return [range.startColumnIndex, range.endColumnIndex, warningOnly];
      }),
    ).toEqual([[0, 16, true]]);
  });
});

describe('RegistrationSheetsService', () => {
  const sheetId = sheetIdFor(EVENT_ID);
  let data = [event()];
  const findMany = jest.fn(async () => data);
  const makeService = () =>
    new RegistrationSheetsService(
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
  // What the spreadsheet holds and whether a styling call fails.
  let sheets: object[] = [];
  let failStyling = false;
  let fetchMock: jest.SpyInstance;
  const batches = () =>
    fetchMock.mock.calls
      .filter(([url]) => String(url).endsWith(':batchUpdate'))
      .map(([, init]) => JSON.parse(init.body).requests as object[]);
  const has = (requests: object[], key: string) =>
    requests.some((r) => key in r);
  const absent = registration({
    attended: false,
    attendedAt: null,
    attendedBy: null,
  });

  beforeEach(() => {
    data = [event()];
    sheets = [];
    failStyling = false;
    fetchMock = jest.spyOn(global, 'fetch').mockImplementation((async (
      url: string,
      init?: RequestInit,
    ) => {
      const styling =
        init?.method === 'POST' && String(init.body).includes('addBanding');
      const reply = init?.method === 'POST' ? {} : { sheets };
      return {
        ok: !(styling && failStyling),
        text: async () => 'bad request',
        json: async () => reply,
      };
    }) as unknown as typeof fetch);
  });

  afterEach(() => jest.restoreAllMocks());

  it('copies everything first, then rewrites only changed tabs', async () => {
    const service = makeService();
    await service.tick();
    // Read the tabs, write the data, then style the new tab.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [write, style] = batches();
    expect(has(write, 'addSheet') && !has(write, 'addBanding')).toBe(true);
    expect(has(style, 'addBanding')).toBe(true);

    fetchMock.mockClear();
    findMany.mockClear();
    await service.tick();
    expect(fetchMock).not.toHaveBeenCalled();
    // After the first pass only recent events are read.
    expect(findMany.mock.calls[0]).toEqual([
      expect.objectContaining({
        where: expect.objectContaining({ date: expect.anything() }),
      }),
    ]);

    // A changed tab gets its data again but is not styled twice.
    data = [event([absent])];
    await service.tick();
    expect(batches()).toHaveLength(1);
  });

  it('styles a tab made before the looks existed, and only that one', async () => {
    const grid = { rowCount: 1000, columnCount: 26 };
    sheets = [
      { properties: { sheetId, title: 'old', gridProperties: grid } },
      {
        properties: { sheetId: 5, title: 'styled', gridProperties: grid },
        bandedRanges: [{ bandedRangeId: 1 }],
      },
    ];
    await makeService().tick();
    const [write, style] = batches();
    expect(has(write, 'addSheet')).toBe(false);
    expect(has(style, 'addBanding')).toBe(true);

    fetchMock.mockClear();
    sheets = [{ ...sheets[0], bandedRanges: [{ bandedRangeId: 2 }] }];
    await makeService().tick();
    expect(batches()).toHaveLength(1);
  });

  it('keeps the data when styling fails', async () => {
    failStyling = true;
    const service = makeService();
    await service.tick();
    expect(batches()).toHaveLength(2);

    // No pause after a styling error: the next change is written right away.
    fetchMock.mockClear();
    data = [event([absent])];
    await service.tick();
    expect(batches()).toHaveLength(1);
  });

  it('rewrites a tab on demand and links to it', async () => {
    await expect(makeService().syncEvent(EVENT_ID)).resolves.toEqual({
      url: `https://docs.google.com/spreadsheets/d/sheet-1/edit#gid=${sheetId}`,
    });
    expect(batches()).toHaveLength(2);
  });
});
