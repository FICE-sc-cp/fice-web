import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { seedDepartments } from '../src/config/department-seed';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const results = await seedDepartments({
    findBySlug: (slug) =>
      prisma.department.findUnique({ where: { slug }, select: { id: true } }),
    findUnlinkedByName: (name) =>
      prisma.department.findFirst({
        where: { slug: null, name: { equals: name, mode: 'insensitive' } },
        select: { id: true, shortName: true },
      }),
    link: async (id, data) => {
      await prisma.department.update({ where: { id }, data });
    },
    create: async (data) => {
      await prisma.department.create({ data });
    },
  });
  for (const r of results) {
    console.log(`${r.action.padEnd(8)} ${r.slug.padEnd(13)} ${r.name}`);
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
