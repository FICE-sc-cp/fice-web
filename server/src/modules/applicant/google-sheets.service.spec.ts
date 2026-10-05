import {
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
    process.env.GOOGLE_SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/xxx/exec';
    expect(service.isConfigured()).toBe(true);
  });

  it('gracefully skips append if not configured', async () => {
    const res = await service.appendApplicant(sampleApplicant);
    expect(res.success).toBe(false);
    expect(res.error).toBe('not_configured');
  });

  it('fails sync if not configured', async () => {
    const res = await service.syncAllApplicants([sampleApplicant]);
    expect(res.success).toBe(false);
    expect(res.synced).toBe(0);
  });
});
