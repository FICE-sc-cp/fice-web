import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  DepartmentMemberRole,
  EventQuestionType,
  PrismaClient,
} from '@prisma/client';

type MemberSeed = {
  role: DepartmentMemberRole;
  firstName: string;
  lastName: string;
  specialization: string | null;
  telegramTag: string;
  quote: string | null;
  dept: string;
};

type EventSeed = {
  name: string;
  date: Date;
  description: string;
  location: string;
  timeNote?: string;
  registrationCloseDate?: Date;
  feeAmount?: number;
  feeRequisites?: string;
  dept: string;
  details: {
    description: string;
    moneyCollected: number;
    charityAmount: number;
    visitorsAmount: number;
  };
  program?: { time: string; title: string; order: number }[];
  questions?: {
    label: string;
    type: EventQuestionType;
    required: boolean;
    options: string[];
    order: number;
  }[];
};

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Idempotent: wipes every table (children → parents so FKs never block) and
 * recreates the whole dataset, so the script can be re-run safely.
 *
 * Image fields are intentionally left `null` — the frontend falls back to its
 * own placeholders in `client/web/public` (real images get uploaded later via
 * the admin panel). `mediaUrl()` resolves stored paths against the API origin,
 * so a Next public path can't be stored here directly anyway.
 */
async function reset() {
  await prisma.eventRegistrationAnswer.deleteMany();
  await prisma.eventRegistration.deleteMany();
  await prisma.eventQuestion.deleteMany();
  await prisma.eventProgramItem.deleteMany();
  await prisma.eventPartner.deleteMany();
  await prisma.donation.deleteMany();
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
  await prisma.user.deleteMany();
}

// ── Departments (each with a 1:1 head + 1:1 details) ──────────────────────────
const DEPARTMENTS = [
  {
    key: 'presidency',
    name: 'Президія',
    short: 'Керівництво студрадою та стратегія розвитку',
    head: {
      firstName: 'Максим',
      lastName: 'Коваль',
      jobDescription: 'Голова студентської ради',
      telegramTag: '@maks_koval',
    },
    details: {
      about:
        'Президія координує роботу всіх департаментів, формує стратегію та представляє студраду перед адміністрацією факультету.',
      detailedDescription:
        'До складу президії входять голова, заступники та секретар. Ми ухвалюємо ключові рішення, плануємо семестр і слідкуємо за прозорістю роботи організації.',
      exampleOfWork: 'Щорічний звіт студради та план розвитку факультету.',
    },
  },
  {
    key: 'secretariat',
    name: 'Секретаріат',
    short: 'Документообіг та внутрішні процеси',
    head: {
      firstName: 'Дмитро',
      lastName: 'Бондаренко',
      jobDescription: 'Керівник секретаріату',
      telegramTag: '@dmytro_b',
    },
    details: {
      about:
        'Секретаріат веде документацію, протоколи зустрічей та облік активностей студради.',
      detailedDescription:
        'Ми відповідаємо за порядок: збираємо звіти департаментів, ведемо базу учасників та готуємо офіційні листи.',
      exampleOfWork: 'Протоколи засідань та реєстр учасників студради.',
    },
  },
  {
    key: 'projects',
    name: 'Проєктний департамент',
    short: 'Створюємо події та можливості для студентів',
    head: {
      firstName: 'Артем',
      lastName: 'Гриценко',
      jobDescription: 'Керівник проєктного департаменту',
      telegramTag: '@artem_g',
    },
    details: {
      about:
        'Проєктний департамент реалізує події та ініціативи для студентів факультету — від ідеї до втілення.',
      detailedDescription:
        'Ми плануємо активності, працюємо з партнерами, формуємо команди та доводимо проєкти до результату.',
      exampleOfWork: 'Організація FICEexpo та хакатону FICE Hack.',
    },
  },
  {
    key: 'media',
    name: 'Департамент медіа',
    short: 'Контент, фото, відео та соцмережі',
    head: {
      firstName: 'Юлія',
      lastName: 'Шевченко',
      jobDescription: 'Керівниця медіа',
      telegramTag: '@yulia_media',
    },
    details: {
      about:
        'Команда медіа працює над контентом студради: фото, відео, дизайн і соцмережі.',
      detailedDescription:
        'Ми забезпечуємо актуальну комунікацію, висвітлюємо життя факультету та формуємо візуальний стиль студради.',
      exampleOfWork: 'Репортаж із посвяти першокурсників та ведення Instagram.',
    },
  },
  {
    key: 'partnerships',
    name: 'Департамент партнерств',
    short: 'Співпраця з компаніями та організаціями',
    head: {
      firstName: 'Катерина',
      lastName: 'Поліщук',
      jobDescription: 'Керівниця партнерств',
      telegramTag: '@kateryna_p',
    },
    details: {
      about:
        'Департамент партнерств шукає можливості для студентів та залучає компанії до співпраці.',
      detailedDescription:
        'Ми працюємо над проєктами, підтримкою благодійних ініціатив та розширюємо можливості для студспільноти.',
      exampleOfWork: 'Партнерські угоди з ІТ-компаніями для кар’єрних заходів.',
    },
  },
  {
    key: 'merch',
    name: 'Департамент мерчу',
    short: 'Дизайн та продукти бренду ФІОТ',
    head: {
      firstName: 'Владислав',
      lastName: 'Мороз',
      jobDescription: 'Керівник мерчу',
      telegramTag: '@vlad_merch',
    },
    details: {
      about: 'Команда розробляє дизайн та створює нові продукти бренду ФІОТ.',
      detailedDescription:
        'Працюємо над якістю, стилем і впізнаваністю бренду — від худі до стікерпаків.',
      exampleOfWork: 'Колекція мерчу до Дня факультету.',
    },
  },
  {
    key: 'quality',
    name: 'Департамент якості освіти',
    short: 'Аналіз освітнього процесу та фідбек',
    head: {
      firstName: 'Олександра',
      lastName: 'Ткач',
      jobDescription: 'Керівниця департаменту якості освіти',
      telegramTag: '@olexandra_t',
    },
    details: {
      about:
        'Департамент аналізує освітній процес, збирає фідбек і допомагає вирішувати академічні питання.',
      detailedDescription:
        'Ми проводимо опитування, працюємо зі скаргами щодо силабусів та представляємо інтереси студентів.',
      exampleOfWork: 'Семестрове опитування про якість викладання.',
    },
  },
  {
    key: 'applicants',
    name: 'Департамент по роботі з абітурієнтами',
    short: 'Заходи та підтримка майбутніх студентів',
    head: {
      firstName: 'Богдан',
      lastName: 'Лисенко',
      jobDescription: 'Керівник роботи з абітурієнтами',
      telegramTag: '@bohdan_l',
    },
    details: {
      about:
        'Департамент проводить заходи для майбутніх студентів та консультує щодо вступу.',
      detailedDescription:
        'Займаємось інформаційною підтримкою вступної кампанії, днями відкритих дверей та профорієнтацією.',
      exampleOfWork: 'День відкритих дверей ФІОТ.',
    },
  },
];

// ── Team roster (DepartmentMember — separate from DepartmentHead) ──────────────
const MEMBERS: MemberSeed[] = [
  {
    role: 'HEAD',
    firstName: 'Максим',
    lastName: 'Коваль',
    specialization: 'Стратегія та координація',
    telegramTag: '@maks_koval',
    quote: 'Студрада — це про людей, які не бояться брати відповідальність.',
    dept: 'presidency',
  },
  {
    role: 'FIRST_DEPUTY',
    firstName: 'Софія',
    lastName: 'Мельник',
    specialization: 'Розвиток та зовнішні зв’язки',
    telegramTag: '@sofia_m',
    quote: 'Ми робимо факультет місцем, куди хочеться повертатися.',
    dept: 'presidency',
  },
  {
    role: 'SECRETARY',
    firstName: 'Дмитро',
    lastName: 'Бондаренко',
    specialization: 'Документообіг та облік',
    telegramTag: '@dmytro_b',
    quote: null,
    dept: 'secretariat',
  },
  {
    role: 'DEPUTY',
    firstName: 'Олег',
    lastName: 'Ткаченко',
    specialization: 'Зовнішні комунікації',
    telegramTag: '@oleg_t',
    quote: 'Найкращі ідеї народжуються в команді.',
    dept: 'projects',
  },
  {
    role: 'DEPUTY',
    firstName: 'Анна',
    lastName: 'Левченко',
    specialization: 'Внутрішні процеси',
    telegramTag: '@anna_l',
    quote: null,
    dept: 'secretariat',
  },
  {
    role: 'HR',
    firstName: 'Ірина',
    lastName: 'Савчук',
    specialization: 'Рекрутинг та адаптація',
    telegramTag: '@iryna_hr',
    quote: 'Кожен новачок робить команду сильнішою.',
    dept: 'presidency',
  },
  {
    role: 'MEMBER',
    firstName: 'Назар',
    lastName: 'Кравець',
    specialization: 'Відеопродакшн',
    telegramTag: '@nazar_k',
    quote: null,
    dept: 'media',
  },
  {
    role: 'MEMBER',
    firstName: 'Вікторія',
    lastName: 'Романенко',
    specialization: 'Графічний дизайн',
    telegramTag: '@vika_r',
    quote: null,
    dept: 'media',
  },
  {
    role: 'MEMBER',
    firstName: 'Денис',
    lastName: 'Гнатюк',
    specialization: 'SMM',
    telegramTag: '@denys_g',
    quote: null,
    dept: 'media',
  },
  {
    role: 'MEMBER',
    firstName: 'Марія',
    lastName: 'Бойко',
    specialization: 'Координація заходів',
    telegramTag: '@maria_b',
    quote: null,
    dept: 'projects',
  },
  {
    role: 'MEMBER',
    firstName: 'Тарас',
    lastName: 'Коваленко',
    specialization: 'Робота з партнерами',
    telegramTag: '@taras_k',
    quote: null,
    dept: 'partnerships',
  },
  {
    role: 'MEMBER',
    firstName: 'Катерина',
    lastName: 'Шпак',
    specialization: 'Фандрейзинг',
    telegramTag: '@kate_sh',
    quote: null,
    dept: 'partnerships',
  },
  {
    role: 'MEMBER',
    firstName: 'Владислав',
    lastName: 'Гончар',
    specialization: 'Дизайн мерчу',
    telegramTag: '@vlad_g',
    quote: null,
    dept: 'merch',
  },
  {
    role: 'MEMBER',
    firstName: 'Олександра',
    lastName: 'Юрченко',
    specialization: 'Аналіз освіти',
    telegramTag: '@olexa_y',
    quote: null,
    dept: 'quality',
  },
  {
    role: 'MEMBER',
    firstName: 'Богдан',
    lastName: 'Мельниченко',
    specialization: 'Профорієнтація',
    telegramTag: '@bohdan_m',
    quote: null,
    dept: 'applicants',
  },
  {
    role: 'MEMBER',
    firstName: 'Аліна',
    lastName: 'Демченко',
    specialization: 'Контент для абітурієнтів',
    telegramTag: '@alina_d',
    quote: null,
    dept: 'applicants',
  },
  {
    role: 'MEMBER',
    firstName: 'Артем',
    lastName: 'Поліщук',
    specialization: 'Технічна підтримка заходів',
    telegramTag: '@artem_p',
    quote: null,
    dept: 'projects',
  },
  {
    role: 'MEMBER',
    firstName: 'Юлія',
    lastName: 'Кравчук',
    specialization: 'Копірайтинг',
    telegramTag: '@yulia_k',
    quote: null,
    dept: 'media',
  },
];

// ── Events (each with 1:1 EventDetails; charity sums to 650 000 for /facts) ────
const EVENTS: EventSeed[] = [
  {
    name: 'FICEexpo 2026',
    date: new Date('2026-10-15T11:00:00Z'),
    description:
      'Найбільша технічна виставка факультету: воркшопи, кейноути від ІТ-компаній та ярмарок вакансій.',
    location: 'Ливарка КПІ',
    timeNote: '11:00 – 19:00',
    registrationCloseDate: new Date('2026-10-10T23:59:00Z'),
    feeAmount: 150,
    feeRequisites: 'Оплата за бейдж учасника та welcome-pack.',
    dept: 'projects',
    details: {
      description: 'Технічна виставка та ярмарок вакансій ФІОТ.',
      moneyCollected: 95000,
      charityAmount: 60000,
      visitorsAmount: 800,
    },
    program: [
      { time: '11:00', title: 'Реєстрація та welcome-кава', order: 1 },
      { time: '12:00', title: 'Відкриття та кейноут від партнерів', order: 2 },
      { time: '13:30', title: 'Технічні воркшопи', order: 3 },
      { time: '16:00', title: 'Ярмарок вакансій і нетворкінг', order: 4 },
      { time: '18:00', title: 'Афтепаті', order: 5 },
    ],
    questions: [
      {
        label: 'Ваш курс навчання',
        type: 'SINGLE_CHOICE',
        required: true,
        options: ['1 курс', '2 курс', '3 курс', '4 курс', 'Магістратура'],
        order: 1,
      },
      {
        label: 'Чи потрібен вам бейдж учасника?',
        type: 'YES_NO',
        required: false,
        options: [],
        order: 2,
      },
      {
        label: 'Які теми воркшопів вам найцікавіші?',
        type: 'LONG_TEXT',
        required: false,
        options: [],
        order: 3,
      },
    ],
  },
  {
    name: 'FICE Hack — хакатон з розробки',
    date: new Date('2026-11-22T09:00:00Z'),
    description:
      '48-годинний хакатон, де команди створюють робочі прототипи продуктів за реальними завданнями партнерів.',
    location: 'Корпус 18 КПІ',
    timeNote: '48 годин нон-стоп',
    registrationCloseDate: new Date('2026-11-15T23:59:00Z'),
    dept: 'projects',
    details: {
      description: 'Хакатон із розробки прототипів за завданнями партнерів.',
      moneyCollected: 40000,
      charityAmount: 40000,
      visitorsAmount: 400,
    },
    program: [
      {
        time: 'День 1, 09:00',
        title: 'Відкриття та презентація завдань',
        order: 1,
      },
      { time: 'День 1, 11:00', title: 'Старт хакатону', order: 2 },
      { time: 'День 2, 18:00', title: 'Захист проєктів', order: 3 },
      { time: 'День 2, 20:00', title: 'Нагородження переможців', order: 4 },
    ],
    questions: [
      {
        label: 'Назва команди',
        type: 'SHORT_TEXT',
        required: true,
        options: [],
        order: 1,
      },
      {
        label: 'Ваша роль у команді',
        type: 'SINGLE_CHOICE',
        required: true,
        options: ['Frontend', 'Backend', 'Design', 'PM', 'ML'],
        order: 2,
      },
    ],
  },
  {
    name: 'Благодійний концерт «Разом до перемоги»',
    date: new Date('2026-04-12T18:00:00Z'),
    description:
      'Благодійний концерт на підтримку ЗСУ за участі студентських гуртів.',
    location: 'Актова зала КПІ',
    dept: 'projects',
    details: {
      description: 'Благодійний концерт на підтримку ЗСУ.',
      moneyCollected: 220000,
      charityAmount: 180000,
      visitorsAmount: 1200,
    },
  },
  {
    name: 'День ФІОТ 2026',
    date: new Date('2026-05-17T12:00:00Z'),
    description:
      'Свято факультету: активності, фуд-корти, виступи та ярмарок мерчу.',
    location: 'Сквер біля корпусу 18',
    dept: 'merch',
    details: {
      description: 'Святкування Дня факультету інформатики.',
      moneyCollected: 160000,
      charityAmount: 150000,
      visitorsAmount: 1500,
    },
  },
  {
    name: 'Кар’єрний день ФІОТ',
    date: new Date('2026-03-20T10:00:00Z'),
    description:
      'Зустрічі з роботодавцями, mock-співбесіди та лекції про побудову кар’єри в ІТ.',
    location: 'Корпус 18 КПІ',
    dept: 'partnerships',
    details: {
      description: 'День кар’єри з ІТ-компаніями.',
      moneyCollected: 130000,
      charityAmount: 130000,
      visitorsAmount: 700,
    },
  },
  {
    name: 'Кіберспортивний турнір FICE Cup',
    date: new Date('2026-02-28T16:00:00Z'),
    description: 'Студентський кіберспортивний турнір із Dota 2 та CS2.',
    location: 'Кіберарена КПІ',
    dept: 'projects',
    details: {
      description: 'Кіберспортивний турнір серед студентів.',
      moneyCollected: 110000,
      charityAmount: 90000,
      visitorsAmount: 850,
    },
  },
];

// ── Partners (count of approved feeds /facts partnersCount) ────────────────────
const PARTNERS = [
  {
    name: 'monobank',
    websiteLink: 'https://monobank.ua',
    shortDescription: 'Фінансовий партнер заходів',
    isApproved: true,
  },
  {
    name: 'SoftServe',
    websiteLink: 'https://softserveinc.com',
    shortDescription: 'Партнер кар’єрних заходів',
    isApproved: true,
  },
  {
    name: 'EPAM',
    websiteLink: 'https://epam.com',
    shortDescription: 'Освітні воркшопи та менторство',
    isApproved: true,
  },
  {
    name: 'GlobalLogic',
    websiteLink: 'https://globallogic.com',
    shortDescription: 'Партнер хакатонів',
    isApproved: true,
  },
  {
    name: 'MacPaw',
    websiteLink: 'https://macpaw.com',
    shortDescription: 'Підтримка студентських проєктів',
    isApproved: true,
  },
  {
    name: 'Ajax Systems',
    websiteLink: 'https://ajax.systems',
    shortDescription: 'Технологічний партнер',
    isApproved: true,
  },
  {
    name: 'Genesis',
    websiteLink: 'https://gen.tech',
    shortDescription: 'Партнер з продуктового менеджменту',
    isApproved: true,
  },
  {
    name: 'Sigma Software',
    websiteLink: 'https://sigma.software',
    shortDescription: 'Менторські програми',
    isApproved: true,
  },
  {
    name: 'Comfy',
    websiteLink: 'https://comfy.ua',
    shortDescription: 'Партнер із техніки',
    isApproved: true,
  },
  {
    name: 'Rozetka',
    websiteLink: 'https://rozetka.com.ua',
    shortDescription: 'Подарунки для переможців',
    isApproved: true,
  },
  {
    name: 'Київстар',
    websiteLink: 'https://kyivstar.ua',
    shortDescription: 'Партнер зі звʼязку',
    isApproved: true,
  },
  {
    name: 'Нова пошта',
    websiteLink: 'https://novaposhta.ua',
    shortDescription: 'Логістичний партнер',
    isApproved: true,
  },
  // Pending applications (not counted in facts)
  {
    name: 'Uklon',
    websiteLink: 'https://uklon.com.ua',
    shortDescription: 'Заявка на партнерство',
    isApproved: false,
  },
  {
    name: 'Solidgate',
    websiteLink: 'https://solidgate.com',
    shortDescription: 'Заявка на партнерство',
    isApproved: false,
  },
];

async function main() {
  await reset();

  // Departments (nested head + details).
  const deptIds: Record<string, string> = {};
  for (const d of DEPARTMENTS) {
    const created = await prisma.department.create({
      data: {
        name: d.name,
        shortDescription: d.short,
        head: { create: d.head },
        details: { create: d.details },
      },
    });
    deptIds[d.key] = created.id;
  }

  // Team members + their department assignments (M:N).
  for (const m of MEMBERS) {
    const created = await prisma.departmentMember.create({
      data: {
        role: m.role,
        firstName: m.firstName,
        lastName: m.lastName,
        specialization: m.specialization,
        telegramTag: m.telegramTag,
        quote: m.quote,
      },
    });
    await prisma.departmentMemberAssignment.create({
      data: { memberId: created.id, departmentId: deptIds[m.dept] },
    });
  }

  // Partners.
  const partnerIds: Record<string, string> = {};
  for (const p of PARTNERS) {
    const created = await prisma.partner.create({ data: p });
    partnerIds[p.name] = created.id;
  }

  // Events (nested details + program + questions), then link a few partners.
  const eventIds: Record<string, string> = {};
  for (const e of EVENTS) {
    const created = await prisma.event.create({
      data: {
        name: e.name,
        date: e.date,
        description: e.description,
        location: e.location,
        timeNote: e.timeNote ?? null,
        registrationCloseDate: e.registrationCloseDate ?? null,
        feeAmount: e.feeAmount ?? null,
        feeRequisites: e.feeRequisites ?? null,
        details: {
          create: {
            description: e.details.description,
            moneyCollected: e.details.moneyCollected,
            charityAmount: e.details.charityAmount,
            visitorsAmount: e.details.visitorsAmount,
            departmentId: deptIds[e.dept],
          },
        },
        program: e.program ? { create: e.program } : undefined,
        questions: e.questions ? { create: e.questions } : undefined,
      },
    });
    eventIds[e.name] = created.id;
  }

  await prisma.eventPartner.createMany({
    data: [
      {
        eventId: eventIds['FICEexpo 2026'],
        partnerId: partnerIds['SoftServe'],
      },
      { eventId: eventIds['FICEexpo 2026'], partnerId: partnerIds['EPAM'] },
      { eventId: eventIds['FICEexpo 2026'], partnerId: partnerIds['MacPaw'] },
      {
        eventId: eventIds['FICE Hack — хакатон з розробки'],
        partnerId: partnerIds['GlobalLogic'],
      },
      {
        eventId: eventIds['FICE Hack — хакатон з розробки'],
        partnerId: partnerIds['Genesis'],
      },
      {
        eventId: eventIds['Кар’єрний день ФІОТ'],
        partnerId: partnerIds['Sigma Software'],
      },
      {
        eventId: eventIds['Благодійний концерт «Разом до перемоги»'],
        partnerId: partnerIds['monobank'],
      },
    ],
  });

  // Fundraisers + donations.
  const pickup = await prisma.fundraiser.create({
    data: {
      name: 'Пікап для евакуаційної групи 47-ї бригади',
      status: 'ACTIVE',
      description:
        'Повнопривідний пікап для медиків-евакуаторів, які щодня вивозять поранених із «нуля». Кожен донат — це врятовані життя.',
      story:
        'Евакуаційна група 47-ї бригади працює на одному з найгарячіших напрямків. Їхній старий мікроавтобус більше не витримує бездоріжжя — потрібен надійний повнопривідний пікап.\n\nРазом зі студентами ФІОТ, випускниками та партнерами ми збираємо повну суму на купівлю, ремонт і підготовку авто. Звітність — після кожного етапу, прозоро й до копійки.',
      location: 'Запорізький напрямок',
      goalAmount: 480000,
      currentAmount: 326500,
      donationsCount: 1248,
      cardNumber: '5375 4141 0000 1234',
      jarUrl: 'https://send.monobank.ua/jar/demo',
      startDate: new Date('2026-06-01T00:00:00Z'),
      endDate: new Date('2026-07-04T00:00:00Z'),
    },
  });

  const now = Date.now();
  await prisma.donation.createMany({
    data: [
      {
        fundraiserId: pickup.id,
        name: 'Олег К.',
        amount: 500,
        comment: 'Тримаймося!',
        createdAt: new Date(now - 2 * 60 * 1000),
      },
      {
        fundraiserId: pickup.id,
        name: null,
        amount: 1000,
        createdAt: new Date(now - 14 * 60 * 1000),
      },
      {
        fundraiserId: pickup.id,
        name: 'Марія В.',
        amount: 250,
        createdAt: new Date(now - 38 * 60 * 1000),
      },
      {
        fundraiserId: pickup.id,
        name: 'Андрій П.',
        amount: 2000,
        comment: 'Дякую за вашу роботу',
        createdAt: new Date(now - 3 * 60 * 60 * 1000),
      },
      {
        fundraiserId: pickup.id,
        name: 'Софія',
        amount: 150,
        createdAt: new Date(now - 5 * 60 * 60 * 1000),
      },
    ],
  });

  await prisma.fundraiser.createMany({
    data: [
      {
        name: 'Збір на FPV-дрони для випускників',
        status: 'ACTIVE',
        description: 'Збираємо на FPV-дрони для підрозділу випускників ФІОТ.',
        location: 'Покровський напрямок',
        goalAmount: 110000,
        currentAmount: 70000,
        donationsCount: 214,
        cardNumber: '4441 1111 2222 3333',
        startDate: new Date('2026-05-01T00:00:00Z'),
        endDate: new Date('2026-07-15T00:00:00Z'),
      },
      {
        name: 'Тепла зима для військових',
        status: 'CLOSED',
        description:
          'Збір на термобілизну та спальники. Дякуємо всім, хто долучився!',
        goalAmount: 80000,
        currentAmount: 80000,
        donationsCount: 312,
        startDate: new Date('2025-11-01T00:00:00Z'),
        endDate: new Date('2025-12-15T00:00:00Z'),
      },
      {
        name: 'Генератор для шпиталю',
        status: 'CLOSED',
        description:
          'Збір на потужний генератор для прифронтового шпиталю. Ціль досягнуто!',
        goalAmount: 150000,
        currentAmount: 150000,
        donationsCount: 540,
        startDate: new Date('2026-01-10T00:00:00Z'),
        endDate: new Date('2026-02-20T00:00:00Z'),
      },
    ],
  });

  // News (mix of categories; two are event announcements with eventDate).
  await prisma.news.createMany({
    data: [
      {
        title: 'Стартував набір до студради ФІОТ',
        details:
          'Шукаємо активних студентів у всі департаменти. Подавай заявку до 30 червня та долучайся до команди!',
        category: 'EVENTS',
        registrationLink: 'https://forms.gle/demo-join',
        publishDate: new Date('2026-06-01T09:00:00Z'),
      },
      {
        title: 'Звіт благодійного концерту',
        details:
          'Разом із вами ми зібрали 180 000 грн на підтримку ЗСУ. Дякуємо кожному, хто був із нами!',
        category: 'CHARITY',
        publishDate: new Date('2026-04-13T12:00:00Z'),
      },
      {
        title: 'Новий партнер — SoftServe',
        details:
          'Раді оголосити про партнерство із SoftServe. На нас чекають воркшопи, менторство та стажування.',
        category: 'PARTNERS',
        publishDate: new Date('2026-03-22T10:00:00Z'),
      },
      {
        title: 'ФІОТ переміг у студентському хакатоні',
        details:
          'Команда нашого факультету посіла перше місце на всеукраїнському студентському хакатоні. Вітаємо!',
        category: 'ACHIEVEMENTS',
        publishDate: new Date('2026-03-05T15:00:00Z'),
      },
      {
        title: 'Гайд: що робити, якщо викладач не дотримується силабусу',
        details:
          'Департамент якості освіти підготував покрокову інструкцію, куди звертатися та як захистити свої права.',
        category: 'EDUCATION',
        publishDate: new Date('2026-02-18T11:00:00Z'),
      },
      {
        title: 'FICEexpo 2026: реєстрація відкрита',
        details:
          'Технічна виставка, воркшопи та ярмарок вакансій. Реєструйся та приходь 15 жовтня!',
        category: 'EVENTS',
        eventDate: new Date('2026-10-15T11:00:00Z'),
        eventLocation: 'Ливарка КПІ',
        registrationLink: 'https://forms.gle/demo-ficeexpo',
        publishDate: new Date('2026-06-10T09:00:00Z'),
      },
    ],
  });

  // Join applications (admin-side data).
  await prisma.applicant.create({
    data: {
      firstName: 'Марія',
      middleName: 'Ігорівна',
      lastName: 'Литвин',
      telegramTag: '@maria_l',
      group: 'ІП-31',
      phoneNumber: '+380991234567',
      motivation: 'Хочу організовувати заходи та розвивати факультет.',
      experience: 'Була старостою групи та волонтерила на студентських подіях.',
      applicantDepartments: {
        create: [
          {
            departmentId: deptIds['projects'],
            question: 'Який мій досвід в івентах?',
          },
          { departmentId: deptIds['media'] },
        ],
      },
    },
  });

  await prisma.applicant.create({
    data: {
      firstName: 'Олег',
      middleName: 'Андрійович',
      lastName: 'Сидоренко',
      telegramTag: '@oleg_s',
      group: 'ІО-22',
      phoneNumber: '+380671112233',
      motivation: 'Цікавить робота з партнерами та залучення компаній.',
      applicantDepartments: {
        create: [{ departmentId: deptIds['partnerships'] }],
      },
    },
  });

  await prisma.applicant.create({
    data: {
      firstName: 'Софія',
      middleName: 'Олегівна',
      lastName: 'Кравчук',
      telegramTag: '@sofia_k',
      group: 'ІА-13',
      phoneNumber: '+380504445566',
      motivation: 'Люблю дизайн та контент, хочу долучитися до медіа.',
      applicantDepartments: {
        create: [
          { departmentId: deptIds['media'] },
          { departmentId: deptIds['merch'] },
        ],
      },
    },
  });

  console.log('Seed complete ✅');
  console.table({
    departments: DEPARTMENTS.length,
    members: MEMBERS.length,
    events: EVENTS.length,
    partners: PARTNERS.length,
    fundraisers: 4,
    news: 6,
    applicants: 3,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
