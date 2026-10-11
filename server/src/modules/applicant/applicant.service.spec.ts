import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApplicantService } from './applicant.service';
import { PrismaService } from '../../database/prisma.service';
import { BotService } from '../../bot/bot.service';

describe('ApplicantService', () => {
  let service: ApplicantService;
  let prisma: any;
  let bot: any;
  let siteSetting: { findUnique: jest.Mock; upsert: jest.Mock };

  beforeEach(() => {
    siteSetting = {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest
        .fn()
        .mockImplementation(
          ({ create }: { create: { key: string; value: string } }) => ({
            ...create,
            updatedAt: new Date('2026-10-11T12:00:00Z'),
          }),
        ),
    };
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
      siteSetting,
    };
    bot = {
      notifyGroup: jest.fn().mockResolvedValue(undefined),
    };
    const googleSheets = {
      appendApplicant: jest.fn().mockResolvedValue({ success: true }),
      syncAllApplicants: jest.fn().mockResolvedValue({ success: true, synced: 0 }),
    };

    service = new ApplicantService(
      prisma as unknown as PrismaService,
      bot as unknown as BotService,
      googleSheets as any,
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

  describe('closing applications', () => {
    const stored = (value: string) => ({
      key: 'applicationsOpen',
      value,
      updatedAt: new Date('2026-10-11T12:00:00Z'),
    });
    const saveApplicant = () =>
      (prisma as { applicant: { create: jest.Mock } }).applicant.create;

    it('accepts applications by default, when nothing is stored', async () => {
      await expect(service.getStatus()).resolves.toEqual({
        open: true,
        updatedAt: null,
      });
    });

    it('reports closed after an admin closes them', async () => {
      siteSetting.findUnique.mockResolvedValue(stored('false'));
      await expect(service.getStatus()).resolves.toEqual({
        open: false,
        updatedAt: new Date('2026-10-11T12:00:00Z'),
      });
    });

    it('stores the switch under one key', async () => {
      await expect(service.setStatus(false)).resolves.toEqual({
        open: false,
        updatedAt: new Date('2026-10-11T12:00:00Z'),
      });
      expect(siteSetting.upsert).toHaveBeenCalledWith({
        where: { key: 'applicationsOpen' },
        create: { key: 'applicationsOpen', value: 'false' },
        update: { value: 'false' },
      });
    });

    it('rejects a new application while closed and saves nothing', async () => {
      siteSetting.findUnique.mockResolvedValue(stored('false'));
      await expect(service.create(validDto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.create(validDto)).rejects.toThrow(
        'Подачу заявок зараз закрито',
      );
      expect(saveApplicant()).not.toHaveBeenCalled();
    });

    it('accepts applications again after reopening', async () => {
      siteSetting.findUnique.mockResolvedValue(stored('true'));
      await expect(service.create(validDto)).resolves.toBeDefined();
      expect(saveApplicant()).toHaveBeenCalled();
    });
  });
});
