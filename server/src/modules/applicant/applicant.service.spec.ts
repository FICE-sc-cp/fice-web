import { BadRequestException } from '@nestjs/common';
import { ApplicantService } from './applicant.service';
import { PrismaService } from '../../database/prisma.service';
import { BotService } from '../../bot/bot.service';

describe('ApplicantService', () => {
  let service: ApplicantService;
  let prisma: any;
  let bot: any;

  beforeEach(() => {
    prisma = {
      applicant: {
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'app-uuid',
          ...data,
          applicantDepartments: [],
        })),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      department: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    bot = {
      notifyGroup: jest.fn().mockResolvedValue(undefined),
    };

    service = new ApplicantService(
      prisma as unknown as PrismaService,
      bot as unknown as BotService,
    );
  });

  const validDto = {
    firstName: 'Тарас',
    middleName: 'Григорович',
    lastName: 'Шевченко',
    telegramTag: '@taras_sheva',
    group: 'ІП-31',
    phoneNumber: '+380991234567',
    motivation:
      'Хочу розвивати факультет та створювати круті студентські проєкти для студентів.',
    experience: 'Маю досвід в організації заходів.',
    departments: [{ departmentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }],
  };

  it('successfully creates an applicant with valid FICT group', async () => {
    const res = await service.create(validDto);
    expect(res).toBeDefined();
    expect(prisma.applicant.create).toHaveBeenCalled();
  });

  it('rejects Russian phone numbers', async () => {
    await expect(
      service.create({ ...validDto, phoneNumber: '+79991234567' }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.create({ ...validDto, phoneNumber: '89991234567' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects Belarusian phone numbers', async () => {
    await expect(
      service.create({ ...validDto, phoneNumber: '+375291234567' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects non-FICT groups', async () => {
    // КВ-11 is FPM, not FICT
    await expect(
      service.create({ ...validDto, group: 'КВ-11' }),
    ).rejects.toThrow('лише студенти ФІОТ');
  });

  it('rejects invalid group format', async () => {
    await expect(
      service.create({ ...validDto, group: 'invalid-group' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects punctuation spam in motivation', async () => {
    await expect(
      service.create({ ...validDto, motivation: '. ....................' }),
    ).rejects.toThrow('розділові знаки чи символи');
  });

  it('rejects invalid Telegram tags', async () => {
    await expect(
      service.create({ ...validDto, telegramTag: '@abc' }),
    ).rejects.toThrow(BadRequestException);
  });
});
