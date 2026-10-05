import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { GoogleSheetsService } from '../src/modules/applicant/google-sheets.service';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const sheets = new GoogleSheetsService();

async function main() {
  console.log('🔄 Синхронізація заявок із Google Таблицею...');

  if (!sheets.isConfigured()) {
    console.error(
      '❌ Помилка: Google Sheets не налаштовано в .env!\n' +
        'Потрібно вказати:\n' +
        '  - або GOOGLE_SHEETS_WEBHOOK_URL (Apps Script Web App)\n' +
        '  - або GOOGLE_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY',
    );
    process.exit(1);
  }

  const applicants = await prisma.applicant.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      applicantDepartments: {
        include: { department: true },
      },
    },
  });

  console.log(`📊 Знайдено в базі даних: ${applicants.length} заявок`);

  const result = await sheets.syncAllApplicants(applicants);

  if (result.success) {
    console.log(`✅ Успішно синхронізовано ${result.synced} заявок у Google Таблицю!`);
  } else {
    console.error(`❌ Помилка під час синхронізації: ${result.error}`);
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error('Помилка виконання:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
