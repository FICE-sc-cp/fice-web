import { ApplicantService } from './applicant.service';

describe('ApplicantService.findAll', () => {
  const setup = () => {
    const prisma: any = {
      applicant: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    return {
      prisma,
      service: new ApplicantService(prisma, {} as never),
    };
  };

  it('searches on the server and counts only matching applications', async () => {
    const { prisma, service } = setup();
    await service.findAll({
      page: 2,
      limit: 50,
      search: ' ІП-31 ',
      departmentId: 'd1',
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
      applicantDepartments: { some: { departmentId: 'd1' } },
    };
    expect(prisma.applicant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 50, take: 50 }),
    );
    expect(prisma.applicant.count).toHaveBeenCalledWith({ where });
  });

  it('lists everything without filters', async () => {
    const { prisma, service } = setup();
    await service.findAll({ page: 1, limit: 50 });

    expect(prisma.applicant.count).toHaveBeenCalledWith({ where: {} });
  });
});
