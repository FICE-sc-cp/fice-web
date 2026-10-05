import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export const APPLICANT_SHEET_HEADERS = [
  'Дата подачі',
  'Прізвище',
  'Імʼя',
  'По батькові',
  'Група',
  'Telegram',
  'Телефон',
  'Департаменти',
  'Мотивація',
  'Досвід',
];

export interface ApplicantLike {
  createdAt: Date;
  lastName: string;
  firstName: string;
  middleName: string;
  group: string;
  telegramTag: string;
  phoneNumber: string;
  applicantDepartments?: Array<{ department?: { name: string } }>;
  motivation?: string | null;
  experience?: string | null;
}

export function formatApplicantRow(applicant: ApplicantLike): string[] {
  const dateStr = new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Kyiv',
  }).format(new Date(applicant.createdAt));

  const deptNames = (applicant.applicantDepartments ?? [])
    .map((ad) => ad.department?.name)
    .filter(Boolean)
    .join(', ');

  return [
    dateStr,
    applicant.lastName,
    applicant.firstName,
    applicant.middleName,
    applicant.group,
    applicant.telegramTag,
    applicant.phoneNumber,
    deptNames,
    applicant.motivation ?? '',
    applicant.experience ?? '',
  ];
}

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);

  private cachedToken: { token: string; expiresAt: number } | null = null;

  isConfigured(): boolean {
    if (process.env.GOOGLE_SHEETS_WEBHOOK_URL) return true;
    const { spreadsheetId, clientEmail, privateKey } = this.getCredentials();
    return Boolean(spreadsheetId && clientEmail && privateKey);
  }

  private getCredentials(): {
    spreadsheetId: string;
    sheetName: string;
    clientEmail: string;
    privateKey: string;
  } {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID?.trim() || '';
    const sheetName = process.env.GOOGLE_SHEET_NAME?.trim() || 'Заявки';
    let clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || '';
    let privateKey = process.env.GOOGLE_PRIVATE_KEY?.trim() || '';

    const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE?.trim();
    if (keyFile && (!clientEmail || !privateKey)) {
      try {
        const resolvedPath = path.isAbsolute(keyFile)
          ? keyFile
          : path.resolve(process.cwd(), keyFile);
        if (fs.existsSync(resolvedPath)) {
          const content = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
          if (content.client_email) clientEmail = content.client_email;
          if (content.private_key) privateKey = content.private_key;
        }
      } catch (err) {
        this.logger.warn(`Failed to read key file ${keyFile}: ${err}`);
      }
    }

    if (privateKey) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    return { spreadsheetId, sheetName, clientEmail, privateKey };
  }

  private async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.cachedToken && this.cachedToken.expiresAt > now + 60) {
      return this.cachedToken.token;
    }

    const { clientEmail, privateKey } = this.getCredentials();
    if (!clientEmail || !privateKey) {
      throw new Error('Google Service Account credentials missing');
    }

    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    const b64 = (obj: unknown) =>
      Buffer.from(JSON.stringify(obj)).toString('base64url');
    const unsigned = `${b64(header)}.${b64(payload)}`;

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(unsigned);
    const signature = sign.sign(privateKey, 'base64url');
    const jwt = `${unsigned}.${signature}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google token exchange failed (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.cachedToken = {
      token: data.access_token,
      expiresAt: now + (data.expires_in || 3600),
    };

    return data.access_token;
  }

  private async ensureSheetTabExists(
    token: string,
    spreadsheetId: string,
    sheetName: string,
  ): Promise<void> {
    try {
      const getRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!getRes.ok) return;
      const data = (await getRes.json()) as {
        sheets?: Array<{ properties?: { title?: string } }>;
      };
      const existing = (data.sheets || []).map((s) => s.properties?.title);
      if (!existing.includes(sheetName)) {
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              requests: [{ addSheet: { properties: { title: sheetName } } }],
            }),
          },
        );
      }
    } catch {
      // Non-fatal if sheet check fails
    }
  }

  async appendApplicant(
    applicant: ApplicantLike,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'not_configured' };
    }

    const row = formatApplicantRow(applicant);

    // 1. Webhook mode
    const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL?.trim();
    if (webhookUrl) {
      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'append',
            headers: APPLICANT_SHEET_HEADERS,
            row,
            applicant: {
              id: (applicant as any).id,
              name: `${applicant.lastName} ${applicant.firstName}`,
            },
          }),
        });
        if (!res.ok) {
          throw new Error(`Webhook responded with status ${res.status}`);
        }
        return { success: true };
      } catch (err: any) {
        this.logger.warn(`Google Sheets webhook append failed: ${err.message}`);
        return { success: false, error: err.message };
      }
    }

    // 2. Service Account mode
    try {
      const { spreadsheetId, sheetName } = this.getCredentials();
      const token = await this.getAccessToken();

      await this.ensureSheetTabExists(token, spreadsheetId, sheetName);

      // Check if header row exists
      const headRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1:J1`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (headRes.ok) {
        const headData = (await headRes.json()) as { values?: string[][] };
        if (!headData.values || headData.values.length === 0) {
          await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1:J1?valueInputOption=USER_ENTERED`,
            {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ values: [APPLICANT_SHEET_HEADERS] }),
            },
          );
        }
      }

      // Append row
      const appendRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [row] }),
        },
      );

      if (!appendRes.ok) {
        const errText = await appendRes.text();
        throw new Error(`Append failed (${appendRes.status}): ${errText}`);
      }

      return { success: true };
    } catch (err: any) {
      this.logger.warn(`Google Sheets append failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async syncAllApplicants(
    applicants: ApplicantLike[],
  ): Promise<{ success: boolean; synced: number; error?: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        synced: 0,
        error:
          'Інтеграція з Google Sheets не налаштована. Додайте змінні GOOGLE_SPREADSHEET_ID та ключі в .env',
      };
    }

    const rows = applicants.map(formatApplicantRow);

    // 1. Webhook mode
    const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL?.trim();
    if (webhookUrl) {
      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sync_all',
            headers: APPLICANT_SHEET_HEADERS,
            rows,
          }),
        });
        if (!res.ok) {
          throw new Error(`Webhook responded with status ${res.status}`);
        }
        return { success: true, synced: rows.length };
      } catch (err: any) {
        return { success: false, synced: 0, error: err.message };
      }
    }

    // 2. Service Account mode
    try {
      const { spreadsheetId, sheetName } = this.getCredentials();
      const token = await this.getAccessToken();

      await this.ensureSheetTabExists(token, spreadsheetId, sheetName);

      // Clear existing content to avoid duplicates and re-populate cleanly
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A:J:clear`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      // Write header + all applicant rows
      const allValues = [APPLICANT_SHEET_HEADERS, ...rows];
      const writeRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1:J${allValues.length}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: allValues }),
        },
      );

      if (!writeRes.ok) {
        const errText = await writeRes.text();
        throw new Error(`Sync write failed (${writeRes.status}): ${errText}`);
      }

      return { success: true, synced: rows.length };
    } catch (err: any) {
      return { success: false, synced: 0, error: err.message };
    }
  }
}
