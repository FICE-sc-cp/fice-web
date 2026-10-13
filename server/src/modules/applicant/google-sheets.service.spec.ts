import {
  academicYearSheet,
  formatApplicantRow,
  GoogleSheetsService,
  APPLICANT_SHEET_HEADERS,
} from './google-sheets.service';

describe('GoogleSheetsService', () => {
  let service: GoogleSheetsService;

  beforeEach(() => {
    service = new GoogleSheetsService();
    delete process.env.GOOGLE_SPREADSHEET_ID;
    delete process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;
  });

  const sampleApplicant = {
    createdAt: new Date('2026-10-05T12:00:00Z'),
    lastName: 'Шевченко',
    firstName: 'Тарас',
    middleName: 'Григорович',
    group: 'ІП-31',
    telegramTag: '@taras',
    phoneNumber: '+380991234567',
    applicantDepartments: [{ department: { name: 'IT Департамент' } }],
    motivation: 'Хочу в команду',
    experience: 'Розробка ПЗ',
  };

  it('formats applicant row correctly', () => {
    const row = formatApplicantRow(sampleApplicant);
    expect(row).toHaveLength(APPLICANT_SHEET_HEADERS.length);
    expect(row[1]).toBe('Шевченко');
    expect(row[2]).toBe('Тарас');
    expect(row[4]).toBe('ІП-31');
    expect(row[5]).toBe('@taras');
    expect(row[7]).toBe('IT Департамент');
    expect(row[8]).toBe('Хочу в команду');
    expect(row[9]).toBe('Розробка ПЗ');
  });

  it('returns not configured when env vars are missing', () => {
    expect(service.isConfigured()).toBe(false);
  });

  it('detects webhook configuration', () => {
    process.env.GOOGLE_SHEETS_WEBHOOK_URL =
      'https://script.google.com/macros/s/xxx/exec';
    expect(service.isConfigured()).toBe(true);
  });

  it('gracefully skips append if not configured', async () => {
    const res = await service.appendApplicant(sampleApplicant);
    expect(res.success).toBe(false);
    expect(res.error).toBe('not_configured');
  });

  it('puts applications into one tab per academic year (Kyiv time)', () => {
    const tab = (iso: string) => academicYearSheet('Заявки', new Date(iso));
    expect(tab('2026-08-31T20:59:00Z')).toBe('Заявки 2025-2026'); // 31.08, 23:59
    expect(tab('2026-08-31T21:00:00Z')).toBe('Заявки 2026-2027'); // 01.09, 00:00
    expect(tab('2027-08-31T12:00:00Z')).toBe('Заявки 2026-2027');
    expect(tab('2027-09-01T09:00:00Z')).toBe('Заявки 2027-2028');
  });

  it('sends the webhook one group of rows per academic year', async () => {
    process.env.GOOGLE_SHEETS_WEBHOOK_URL = 'https://example.test/hook';
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true } as Response);
    const nextYear = {
      ...sampleApplicant,
      createdAt: new Date('2027-09-02T10:00:00Z'),
    };

    const res = await service.syncAllApplicants([nextYear, sampleApplicant]);

    expect(res).toEqual({ success: true, synced: 2 });
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string) as {
      sheets: { name: string; rows: unknown[] }[];
      rows: unknown[];
    };
    expect(body.sheets.map((s) => [s.name, s.rows.length])).toEqual([
      ['Заявки 2026-2027', 1],
      ['Заявки 2027-2028', 1],
    ]);
    expect(body.rows).toHaveLength(2);
    fetchMock.mockRestore();
  });

  it('fails sync if not configured', async () => {
    const res = await service.syncAllApplicants([sampleApplicant]);
    expect(res.success).toBe(false);
    expect(res.synced).toBe(0);
  });
});
