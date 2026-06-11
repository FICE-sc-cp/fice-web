import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { FundraiserStatus, PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function reset() {
  await prisma.eventPartner.deleteMany();
  await prisma.applicantDepartment.deleteMany();
  await prisma.departmentMemberAssignment.deleteMany();
  await prisma.event.deleteMany();
  await prisma.eventDetails.deleteMany();
  await prisma.applicant.deleteMany();
  await prisma.departmentMember.deleteMany();
  await prisma.department.deleteMany();
  await prisma.departmentHead.deleteMany();
  await prisma.departmentDetails.deleteMany();
  await prisma.fundraiser.deleteMany();
  await prisma.partner.deleteMany();
  await prisma.news.deleteMany();
  await prisma.statOverride.deleteMany();
}

async function main() {
  await reset();

  const media = await prisma.department.create({
    data: {
      name: 'Медіа',
      shortDescription: 'Ведемо соцмережі, фото та відео студради',
      head: {
        create: {
          firstName: 'Олена',
          lastName: 'Коваль',
          jobDescription: 'Керівниця медіавідділу',
          telegramTag: '@olena_media',
        },
      },
      details: {
        create: {
          about: 'Відділ медіа відповідає за висвітлення діяльності студради.',
          detailedDescription:
            'Робимо фото та відео заходів, ведемо Instagram і Telegram.',
          exampleOfWork: 'Репортаж із посвяти першокурсників.',
        },
      },
    },
  });

  const events = await prisma.department.create({
    data: {
      name: 'Івенти',
      shortDescription: 'Організовуємо заходи та благодійні події',
      head: {
        create: {
          firstName: 'Андрій',
          lastName: 'Шевченко',
          jobDescription: 'Керівник відділу івентів',
          telegramTag: '@andrii_events',
        },
      },
      details: {
        create: {
          about: 'Відділ івентів планує та проводить заходи факультету.',
        },
      },
    },
  });

  const [olena, andrii, dmytro] = await Promise.all([
    prisma.departmentMember.create({
      data: { role: 'HEAD', firstName: 'Олена', lastName: 'Коваль' },
    }),
    prisma.departmentMember.create({
      data: {
        role: 'FIRST_DEPUTY',
        firstName: 'Андрій',
        lastName: 'Шевченко',
        specialization: 'Зовнішня робота',
      },
    }),
    prisma.departmentMember.create({
      data: { role: 'SECRETARY', firstName: 'Дмитро', lastName: 'Бондар' },
    }),
  ]);
  await prisma.departmentMemberAssignment.createMany({
    data: [
      { departmentId: media.id, memberId: olena.id },
      { departmentId: events.id, memberId: andrii.id },
      { departmentId: events.id, memberId: dmytro.id },
    ],
  });

  const concertDetails = await prisma.eventDetails.create({
    data: {
      description: 'Благодійний концерт на підтримку ЗСУ',
      moneyCollected: 25000,
      charityAmount: 25000,
      visitorsAmount: 320,
      departmentId: events.id,
    },
  });
  const concert = await prisma.event.create({
    data: {
      name: 'Благодійний концерт',
      date: new Date('2026-04-12T18:00:00Z'),
      detailsId: concertDetails.id,
    },
  });

  const fairDetails = await prisma.eventDetails.create({
    data: {
      description: 'Ярмарок до Дня факультету',
      moneyCollected: 12000,
      charityAmount: 8000,
      visitorsAmount: 200,
      departmentId: events.id,
    },
  });
  await prisma.event.create({
    data: {
      name: 'Ярмарок ФІОТ',
      date: new Date('2026-05-20T11:00:00Z'),
      detailsId: fairDetails.id,
    },
  });

  const monobank = await prisma.partner.create({
    data: {
      name: 'monobank',
      websiteLink: 'https://monobank.ua',
      shortDescription: 'Фінансовий партнер заходів',
      isApproved: true,
    },
  });
  await prisma.partner.create({
    data: {
      name: 'Comfy',
      websiteLink: 'https://comfy.ua',
      shortDescription: 'Партнер із техніки',
      isApproved: true,
    },
  });
  await prisma.partner.create({
    data: {
      name: 'Нова пошта',
      shortDescription: 'Заявка на партнерство (очікує підтвердження)',
      isApproved: false,
    },
  });
  await prisma.eventPartner.create({
    data: { eventId: concert.id, partnerId: monobank.id },
  });

  await prisma.fundraiser.createMany({
    data: [
      {
        name: 'Збір на дрон',
        status: FundraiserStatus.ACTIVE,
        description: 'Збираємо на FPV-дрон для підрозділу випускників.',
        goalAmount: 100000,
        currentAmount: 64000,
        startDate: new Date('2026-05-01T00:00:00Z'),
        endDate: new Date('2026-07-01T00:00:00Z'),
      },
      {
        name: 'Тепла зима',
        status: FundraiserStatus.CLOSED,
        description: 'Збір на термобілизну. Дякуємо всім!',
        goalAmount: 30000,
        currentAmount: 30000,
        startDate: new Date('2025-11-01T00:00:00Z'),
        endDate: new Date('2025-12-15T00:00:00Z'),
      },
    ],
  });

  await prisma.news.createMany({
    data: [
      {
        title: 'Стартував набір у студраду',
        details: 'Подавай заявку до 30 червня!',
        publishDate: new Date('2026-06-01T09:00:00Z'),
      },
      {
        title: 'Звіт благодійного концерту',
        details: 'Разом зібрали 25 000 грн на підтримку ЗСУ.',
        publishDate: new Date('2026-04-13T12:00:00Z'),
      },
      {
        title: 'Новий партнер — monobank',
        publishDate: new Date('2026-03-20T10:00:00Z'),
      },
    ],
  });

  await prisma.applicant.create({
    data: {
      firstName: 'Марія',
      middleName: 'Ігорівна',
      lastName: 'Литвин',
      telegramTag: '@maria_l',
      group: 'ІП-31',
      phoneNumber: '+380991234567',
      motivation: 'Хочу організовувати заходи та розвивати факультет.',
      applicantDepartments: {
        create: [
          { departmentId: events.id, question: 'Який мій досвід в івентах?' },
          { departmentId: media.id },
        ],
      },
    },
  });

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
