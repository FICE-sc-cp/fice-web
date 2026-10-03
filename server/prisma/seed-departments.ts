import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { DEPARTMENT_NAMES } from '../src/config/department-names';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const name of DEPARTMENT_NAMES) {
    const existing = await prisma.department.findFirst({ where: { name } });
    if (existing) {
      console.log(`exists   ${name}`);
      continue;
    }
    await prisma.department.create({ data: { name } });
    console.log(`created  ${name}`);
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
