import { ConflictException } from '@nestjs/common';
import { BotService } from '../../bot/bot.service';
import { PrismaService } from '../../database/prisma.service';
import { DepartmentService } from './department.service';

function setup(taken: { id: string; name: string } | null) {
  const department = {
    findUnique: jest.fn((args: { where: { id?: string; slug?: string } }) =>
      Promise.resolve(
        args.where.slug !== undefined ? taken : { id: args.where.id },
      ),
    ),
    create: jest.fn(() => Promise.resolve({ id: 'new' })),
    update: jest.fn(() => Promise.resolve({ id: 'a' })),
  };
  const bot = { invalidateDepartmentChats: jest.fn() };
  const service = new DepartmentService(
    { department } as unknown as PrismaService,
    bot as unknown as BotService,
  );
  return { service, department };
}

describe('DepartmentService slug', () => {
  it('refuses to link a page that another department already has', async () => {
    const { service, department } = setup({ id: 'b', name: 'Мерч' });
    await expect(
      service.update('a', { slug: 'merch' }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(service.create({ name: 'X', slug: 'merch' })).rejects.toThrow(
      ConflictException,
    );
    expect(department.update).not.toHaveBeenCalled();
    expect(department.create).not.toHaveBeenCalled();
  });

  it('lets a department keep its own slug', async () => {
    const { service, department } = setup({ id: 'a', name: 'Мерч' });
    await service.update('a', { slug: 'merch', shortName: 'Мерч' });
    expect(department.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { slug: 'merch', shortName: 'Мерч' },
      }),
    );
  });

  it('does not look up the slug when it is cleared', async () => {
    const { service, department } = setup({ id: 'b', name: 'Мерч' });
    await service.update('a', { slug: null });
    expect(department.findUnique).toHaveBeenCalledTimes(1);
    expect(department.update).toHaveBeenCalled();
  });
});
