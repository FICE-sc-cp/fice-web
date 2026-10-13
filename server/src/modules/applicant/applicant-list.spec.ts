import { ApplicantService } from './applicant.service';

describe('ApplicantService.findAll', () => {
  const setup = () => {
    const prisma = {
      applicant: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    return {
      prisma,
      service: new ApplicantService(prisma as never, {} as never, {} as never),
    };
  };

  it('searches on the server and counts only matching applications', async () => {
    const { prisma, service } = setup();
    await service.findAll({
      page: 2,
      limit: 50,
      search: ' ІП-31 ',
      departmentIds: ['d1', 'd2'],
    });

    const text = { contains: 'ІП-31', mode: 'insensitive' };
    const where = {
      OR: [
        { lastName: text },
        { firstName: text },
        { middleName: text },
        { telegramTag: text },
        { group: text },
        { phoneNumber: text },
      ],
      applicantDepartments: { some: { departmentId: { in: ['d1', 'd2'] } } },
    };
    expect(prisma.applicant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 50, take: 50 }),
    );
    expect(prisma.applicant.count).toHaveBeenCalledWith({ where });
  });

  it('filters by submission date in Kyiv days, both ends inclusive', async () => {
    const { prisma, service } = setup();
    await service.findAll({
      page: 1,
      limit: 50,
      from: '2026-09-01',
      to: '2026-09-30',
    });

    expect(prisma.applicant.count).toHaveBeenCalledWith({
      where: {
        createdAt: {
          gte: new Date('2026-08-31T21:00:00Z'),
          lt: new Date('2026-09-30T21:00:00Z'),
        },
      },
    });
  });

  it('lists everything without filters', async () => {
    const { prisma, service } = setup();
    await service.findAll({ page: 1, limit: 50 });

    expect(prisma.applicant.count).toHaveBeenCalledWith({ where: {} });
  });
});
