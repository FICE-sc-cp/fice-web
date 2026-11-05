import {
  ExecutionContext,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { resolveValidatedTelegramUser } from '../../auth/init-data.util';
import { ownUploadExists } from '../../upload/own-upload';
import { MerchAdminController } from './merch-admin.controller';
import { MerchAdminGuard } from './merch-admin.guard';
import { MerchAdminService } from './merch-admin.service';
import type { ProductDto, TemplateDto } from './merch.dto';

jest.mock('../../auth/init-data.util', () => ({
  resolveValidatedTelegramUser: jest.fn(),
}));
jest.mock('../../upload/own-upload', () => ({
  ...jest.requireActual<object>('../../upload/own-upload'),
  ownUploadExists: jest.fn(),
}));

const resolveUser = jest.mocked(resolveValidatedTelegramUser);
const photoExists = jest.mocked(ownUploadExists);

const PHOTO = '/uploads/11111111-1111-1111-1111-111111111111.jpg';
const THUMB = '/uploads/22222222-2222-2222-2222-222222222222.jpg';
const OTHER = '/uploads/33333333-3333-3333-3333-333333333333.jpg';

const DEAD = 'Категорію, тег або групу вже видалено. Оновіть сторінку.';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('db', {
    code,
    clientVersion: 'test',
  });

const data = (value: object): unknown =>
  expect.objectContaining({
    data: expect.objectContaining(value) as unknown,
  });

const KEY = '123e4567-e89b-42d3-a456-426614174000';
const OTHER_KEY = '123e4567-e89b-42d3-a456-426614174001';

function table() {
  return {
    aggregate: jest.fn().mockResolvedValue({ _max: { order: null } }),
    count: jest.fn().mockResolvedValue(1),
    create: jest.fn().mockResolvedValue({ id: 9 }),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
}

function shop(adminChatId: bigint | null = -100123n) {
  const prisma = {
    $queryRaw: jest.fn<Promise<unknown[]>, [string[], ...unknown[]]>(),
    $transaction: jest.fn(),
    merchProduct: table(),
    merchVariant: table(),
    merchProductTag: table(),
    merchProductGroup: table(),
    merchPhoto: table(),
    merchCategory: table(),
    merchTag: table(),
    merchGroup: table(),
    merchGroupMember: table(),
    merchTemplate: table(),
    merchPickupSlot: table(),
    merchOrder: table(),
  };
  /** What the two locking reads of a save find. */
  const stored: { product: object | null; variants: object[] } = {
    product: { saveKey: null },
    variants: [],
  };
  prisma.$queryRaw.mockImplementation(
    (sql) =>
      Promise.resolve(
        sql.join('').includes('"saveKey"')
          ? stored.product
            ? [stored.product]
            : []
          : stored.variants,
      ) as Promise<unknown[]>,
  );
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
  prisma.merchProduct.aggregate.mockResolvedValue({ _min: { order: null } });
  prisma.merchProduct.create.mockResolvedValue({ id: 50 });
  prisma.merchOrder.count.mockResolvedValue(0);
  // These answer how many of the sent ids exist: all of them.
  const allThere = ({ where }: { where: { id: { in?: number[] } } }) =>
    Promise.resolve(where.id.in?.length ?? 1);
  prisma.merchTag.count.mockImplementation(allThere);
  prisma.merchGroup.count.mockImplementation(allThere);
  const bot = { shopConfig: jest.fn().mockResolvedValue({ adminChatId }) };
  return {
    prisma,
    stored,
    service: new MerchAdminService(prisma as never, bot as never),
  };
}

const product = (over: Partial<ProductDto> = {}): ProductDto => ({
  saveKey: KEY,
  seenKey: null,
  title: 'Футболка',
  description: 'Опис',
  categoryId: null,
  tagIds: [],
  groupIds: [],
  variants: [{ size: 'M', color: '', price: '500', order: 0, stock: null }],
  photos: [],
  ...over,
});

const template = (over: Partial<TemplateDto> = {}): TemplateDto => ({
  name: 'Футболка кураторська',
  categoryId: null,
  description: '',
  tagIds: [],
  groupIds: [],
  sizes: ['s'],
  colors: ['Білий'],
  prices: [{ size: 's', color: 'Білий', price: '500' }],
  ...over,
});

beforeEach(() => photoExists.mockReset().mockReturnValue(true));

describe('MerchAdminService products', () => {
  it('updates variants in place and applies the stock difference', async () => {
    const { prisma, service, stored } = shop();
    stored.variants = [
      { id: 7, size: 'M', color: 'Білий', stock: 7 },
      { id: 8, size: 'L', color: 'Білий', stock: 4 },
    ];

    const dto = product({
      variants: [
        // Admin added 5 to the 10 he saw, 3 were sold meanwhile.
        {
          size: ' m ',
          color: 'Білий',
          price: '550',
          order: 0,
          stock: 15,
          stockSeen: 10,
        },
        { size: 'xl', color: 'Білий', price: '550', order: 100, stock: 2 },
      ],
    });
    await expect(service.updateProduct(1, dto)).resolves.toEqual({ ok: true });

    expect(prisma.merchVariant.update).toHaveBeenCalledTimes(1);
    expect(prisma.merchVariant.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { price: '550', stock: 12, order: 0 },
    });
    expect(prisma.merchVariant.createMany).toHaveBeenCalledWith({
      data: [
        {
          size: 'XL',
          color: 'Білий',
          price: '550',
          stock: 2,
          order: 100,
          productId: 1,
        },
      ],
    });
    expect(prisma.merchVariant.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [8] } },
    });
    // Existing products keep their place in the list.
    expect(prisma.merchProduct.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        title: 'Футболка',
        description: 'Опис',
        categoryId: null,
        saveKey: KEY,
      },
    });
  });

  it('locks the product, then the variants before reading their stock', async () => {
    const { prisma, service } = shop();
    await service.updateProduct(1, product());
    const [productLock, variantLock] = prisma.$queryRaw.mock.calls;
    expect(productLock[0].join('')).toContain('FOR UPDATE');
    expect(variantLock[0].join('')).toContain('"MerchVariant"');
    expect(variantLock[0].join('')).toContain('FOR UPDATE');
  });

  it('takes a retry of a save that landed as done, so stock moves once', async () => {
    const { prisma, service, stored } = shop();
    stored.product = { saveKey: KEY };

    await expect(
      service.updateProduct(1, product({ seenKey: null })),
    ).resolves.toEqual({ ok: true });

    expect(prisma.merchProduct.update).not.toHaveBeenCalled();
    expect(prisma.merchVariant.update).not.toHaveBeenCalled();
  });

  it('refuses a form that loaded before someone else saved', async () => {
    const { prisma, service, stored } = shop();
    stored.product = { saveKey: OTHER_KEY };

    await expect(service.updateProduct(1, product())).rejects.toMatchObject({
      status: 409,
    });

    expect(prisma.merchProduct.update).not.toHaveBeenCalled();
  });

  it('saves when the form saw the last save', async () => {
    const { prisma, service, stored } = shop();
    stored.product = { saveKey: OTHER_KEY };

    await service.updateProduct(1, product({ seenKey: OTHER_KEY }));

    expect(prisma.merchProduct.update).toHaveBeenCalledTimes(1);
  });

  it('answers a repeated create with the first product', async () => {
    const { prisma, service } = shop();
    prisma.merchProduct.findUnique.mockResolvedValue({ id: 50 });

    await expect(service.createProduct(product())).resolves.toEqual({ id: 50 });

    expect(prisma.merchProduct.create).not.toHaveBeenCalled();
  });

  it('answers a create that lost the race with the winner', async () => {
    const { prisma, service } = shop();
    prisma.merchProduct.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 51 });
    prisma.merchProduct.create.mockRejectedValue(prismaError('P2002'));

    await expect(service.createProduct(product())).resolves.toEqual({ id: 51 });
  });

  it('keeps the key of a new product', async () => {
    const { prisma, service } = shop();
    await service.createProduct(product());
    expect(prisma.merchProduct.create).toHaveBeenCalledWith(
      data({ saveKey: KEY }),
    );
  });

  it.each<
    [
      string,
      Partial<ProductDto>,
      'merchCategory' | 'merchTag' | 'merchGroup',
      number,
    ]
  >([
    ['category', { categoryId: 5 }, 'merchCategory', 0],
    ['tag', { tagIds: [1, 2] }, 'merchTag', 1],
    ['group', { groupIds: [1, 2] }, 'merchGroup', 1],
  ])('refuses an unknown %s', async (_name, over, ref, found) => {
    const { prisma, service } = shop();
    prisma[ref].count.mockResolvedValue(found);

    const save = service.createProduct(product(over));

    await expect(save).rejects.toMatchObject({ status: 400, message: DEAD });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('writes a repeated tag or group id once', async () => {
    const { prisma, service } = shop();
    await service.createProduct(product({ tagIds: [3, 3], groupIds: [4, 4] }));
    expect(prisma.merchProductTag.createMany).toHaveBeenCalledWith({
      data: [{ productId: 50, tagId: 3 }],
    });
    expect(prisma.merchProductGroup.createMany).toHaveBeenCalledWith({
      data: [{ productId: 50, groupId: 4 }],
    });
  });

  it('gives the same 400 when a label dies during the save', async () => {
    const { prisma, service } = shop();
    prisma.merchProductTag.createMany.mockRejectedValue(prismaError('P2003'));
    await expect(
      service.createProduct(product({ tagIds: [3] })),
    ).rejects.toMatchObject({ status: 400, message: DEAD });
  });

  it('answers with the variant problem', async () => {
    const { prisma, service } = shop();
    const dto = product({
      variants: [{ size: 'M', color: '', price: '0', order: 0 }],
    });
    await expect(service.createProduct(dto)).rejects.toMatchObject({
      status: 400,
      message: 'Некоректна ціна для розміру M',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([[{ title: '   ' }], [{ description: ' \n ' }]])(
    'refuses a blank field: %j',
    async (over) => {
      const { service } = shop();
      await expect(service.createProduct(product(over))).rejects.toMatchObject({
        status: 400,
        message: 'Заповніть назву та опис',
      });
    },
  );

  it.each([[PHOTO], [THUMB]])('refuses a lost file: %s', async (lost) => {
    const { prisma, service } = shop();
    photoExists.mockImplementation((url) => url !== lost);
    const dto = product({
      photos: [{ color: '', url: PHOTO, thumbUrl: THUMB }],
    });
    await expect(service.createProduct(dto)).rejects.toMatchObject({
      status: 400,
      message: 'Фото не знайдено. Завантажте його ще раз.',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('keeps sourceFileId only for an unchanged colour and url', async () => {
    const { prisma, service } = shop();
    prisma.merchPhoto.findMany.mockResolvedValue([
      { color: 'Білий', url: PHOTO, sourceFileId: 'file-a' },
      { color: 'Чорний', url: PHOTO, sourceFileId: 'file-b' },
    ]);
    await service.updateProduct(
      1,
      product({
        photos: [
          { color: ' Білий ', url: PHOTO, thumbUrl: THUMB },
          { color: 'Чорний', url: OTHER, thumbUrl: THUMB },
        ],
      }),
    );
    expect(prisma.merchPhoto.createMany).toHaveBeenCalledWith({
      data: [
        {
          color: 'Білий',
          url: PHOTO,
          thumbUrl: THUMB,
          productId: 1,
          sourceFileId: 'file-a',
        },
        {
          color: 'Чорний',
          url: OTHER,
          thumbUrl: THUMB,
          productId: 1,
          sourceFileId: undefined,
        },
      ],
    });
  });

  it('takes a repeated photo colour once, so the unique key holds', async () => {
    const { prisma, service } = shop();
    await service.createProduct(
      product({
        photos: [
          { color: 'Білий', url: PHOTO, thumbUrl: THUMB },
          { color: 'Білий', url: OTHER, thumbUrl: THUMB },
        ],
      }),
    );
    expect(prisma.merchPhoto.createMany).toHaveBeenCalledWith({
      data: [
        {
          color: 'Білий',
          url: OTHER,
          thumbUrl: THUMB,
          productId: 50,
          sourceFileId: undefined,
        },
      ],
    });
  });

  it('answers 404 for a missing product and writes nothing else', async () => {
    const { prisma, service, stored } = shop();
    stored.product = null;
    await expect(service.updateProduct(1, product())).rejects.toMatchObject({
      status: 404,
      message: 'Товар не знайдено.',
    });
    expect(prisma.merchVariant.createMany).not.toHaveBeenCalled();
  });

  it('puts a new product first', async () => {
    const { prisma, service } = shop();
    prisma.merchProduct.aggregate.mockResolvedValue({ _min: { order: -48 } });

    await expect(service.createProduct(product())).resolves.toEqual({ id: 50 });

    expect(prisma.merchProduct.create).toHaveBeenCalledWith(
      data({ title: 'Футболка', order: -49 }),
    );
  });

  it('starts at 0 in an empty shop', async () => {
    const { prisma, service } = shop();
    await service.createProduct(product());
    expect(prisma.merchProduct.create).toHaveBeenCalledWith(
      data({ title: 'Футболка', order: 0 }),
    );
  });

  it('archives and answers 404 for a missing product', async () => {
    const { prisma, service } = shop();
    await expect(service.setActive(1, false)).resolves.toEqual({
      ok: true,
      isActive: false,
    });
    expect(prisma.merchProduct.updateMany).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isActive: false },
    });
    prisma.merchProduct.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.setActive(1, true)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('hard deletes, count 0 is a 404', async () => {
    const { prisma, service } = shop();
    await expect(service.deleteProduct(1)).resolves.toEqual({ ok: true });
    prisma.merchProduct.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.deleteProduct(1)).rejects.toMatchObject({
      status: 404,
      message: 'Товар не знайдено.',
    });
  });

  it('reorder acts only on sent ids and drops the dead ones', async () => {
    const { prisma, service } = shop();
    prisma.merchProduct.findMany.mockResolvedValue([
      { id: 1, order: 10 },
      { id: 2, order: 20 },
    ]);

    await service.reorderProducts([2, 99, 1]);

    expect(prisma.merchProduct.findMany).toHaveBeenCalledWith({
      where: { id: { in: [2, 99, 1] } },
      select: { id: true, order: true },
    });
    expect(prisma.merchProduct.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.merchProduct.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 2 },
      data: { order: 10 },
    });
    expect(prisma.merchProduct.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 1 },
      data: { order: 20 },
    });
  });
});

describe('MerchAdminService labels', () => {
  it.each([
    ['category', 'merchCategory', 'merchTag'],
    ['tag', 'merchTag', 'merchCategory'],
  ] as const)('%s reaches its own table', async (kind, own, other) => {
    const { prisma, service } = shop();
    prisma[own].findMany.mockResolvedValue([
      { id: 1, order: 0 },
      { id: 2, order: 1 },
    ]);

    await service.createLabel(kind, ' Нове ');
    await service.renameLabel(kind, 1, 'Інше');
    await service.reorderLabels(kind, [2, 1]);
    await service.deleteLabel(kind, 1);

    expect(prisma[own].create).toHaveBeenCalled();
    expect(prisma[own].updateMany).toHaveBeenCalledTimes(3);
    expect(prisma[own].deleteMany).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(prisma[other].create).not.toHaveBeenCalled();
    expect(prisma[other].deleteMany).not.toHaveBeenCalled();
  });

  it('adds a label last, trimmed', async () => {
    const { prisma, service } = shop();
    prisma.merchTag.aggregate.mockResolvedValue({ _max: { order: 4 } });
    await expect(service.createLabel('tag', ' Нове ')).resolves.toEqual({
      id: 9,
    });
    expect(prisma.merchTag.create).toHaveBeenCalledWith(
      data({ name: 'Нове', order: 5 }),
    );
  });

  it('gives the Ukrainian 409 on a duplicate name', async () => {
    const { prisma, service } = shop();
    prisma.merchCategory.create.mockRejectedValue(prismaError('P2002'));
    prisma.merchTag.updateMany.mockRejectedValue(prismaError('P2002'));

    await expect(service.createLabel('category', 'Є')).rejects.toMatchObject({
      status: 409,
      message: 'Така назва вже існує.',
    });
    await expect(service.renameLabel('tag', 1, 'Є')).rejects.toMatchObject({
      status: 409,
      message: 'Така назва вже існує.',
    });
  });

  it('refuses a blank name', async () => {
    const { service } = shop();
    await expect(service.createLabel('tag', '  ')).rejects.toMatchObject({
      status: 400,
    });
  });

  it('answers 404 for a missing label', async () => {
    const { prisma, service } = shop();
    prisma.merchTag.updateMany.mockResolvedValue({ count: 0 });
    prisma.merchTag.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.renameLabel('tag', 1, 'Х')).rejects.toMatchObject({
      status: 404,
      message: 'Не знайдено',
    });
    await expect(service.deleteLabel('tag', 1)).rejects.toMatchObject({
      status: 404,
      message: 'Не знайдено',
    });
  });
});

describe('MerchAdminService templates', () => {
  it('stores normalised sizes and two decimal prices', async () => {
    const { prisma, service } = shop();
    await expect(service.createTemplate(template())).resolves.toEqual({
      id: 9,
    });
    expect(prisma.merchTemplate.create).toHaveBeenCalledWith(
      data({
        name: 'Футболка кураторська',
        description: '',
        categoryId: null,
        tagIds: [],
        groupIds: [],
        sizes: ['S'],
        colors: ['Білий'],
        prices: [{ size: 'S', color: 'Білий', price: '500.00' }],
      }),
    );
  });

  it('answers with the template problem', async () => {
    const { prisma, service } = shop();
    await expect(
      service.createTemplate(template({ prices: [] })),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Вкажіть хоча б одну ціну',
    });
    expect(prisma.merchTemplate.create).not.toHaveBeenCalled();
  });

  it('refuses a dead category instead of a raw foreign key error', async () => {
    const { prisma, service } = shop();
    prisma.merchCategory.count.mockResolvedValue(0);
    await expect(
      service.updateTemplate(1, template({ categoryId: 5 })),
    ).rejects.toMatchObject({ status: 400, message: DEAD });
  });

  it('gives the Ukrainian 409 on a duplicate name', async () => {
    const { prisma, service } = shop();
    prisma.merchTemplate.create.mockRejectedValue(prismaError('P2002'));
    prisma.merchTemplate.updateMany.mockRejectedValue(prismaError('P2002'));
    const conflict = {
      status: 409,
      message: 'Шаблон з такою назвою вже існує.',
    };
    await expect(service.createTemplate(template())).rejects.toMatchObject(
      conflict,
    );
    await expect(service.updateTemplate(1, template())).rejects.toMatchObject(
      conflict,
    );
  });

  it('answers 404 for a missing template', async () => {
    const { prisma, service } = shop();
    prisma.merchTemplate.updateMany.mockResolvedValue({ count: 0 });
    prisma.merchTemplate.deleteMany.mockResolvedValue({ count: 0 });
    const missing = { status: 404, message: 'Шаблон не знайдено.' };
    await expect(service.updateTemplate(1, template())).rejects.toMatchObject(
      missing,
    );
    await expect(service.deleteTemplate(1)).rejects.toMatchObject(missing);
  });
});

describe('MerchAdminService groups', () => {
  const groupWithProducts = (n: number) => {
    const built = shop();
    built.prisma.$queryRaw
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ n }]);
    return built;
  };

  it('refuses while group-only products exist, archived ones included', async () => {
    const { prisma, service } = groupWithProducts(3);

    await expect(service.deleteGroup(1)).rejects.toMatchObject({
      status: 409,
      message: 'Спочатку змініть або видаліть товари цієї групи: 3',
    });

    expect(prisma.merchGroup.delete).not.toHaveBeenCalled();
    const count = prisma.$queryRaw.mock.calls[1][0].join('');
    expect(count).toContain('MerchProductGroup');
    expect(count).not.toContain('isActive');
  });

  it('deletes a group no product depends on alone', async () => {
    const { prisma, service } = groupWithProducts(0);
    await expect(service.deleteGroup(1)).resolves.toEqual({ ok: true });
    expect(prisma.merchGroup.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('locks the group first, so a save cannot slip in between', async () => {
    const { prisma, service } = groupWithProducts(0);
    await service.deleteGroup(1);
    expect(prisma.$queryRaw.mock.calls[0][0].join('')).toContain('FOR UPDATE');
  });

  it('answers 404 for a missing group', async () => {
    const { service } = shop();
    await expect(service.deleteGroup(1)).rejects.toMatchObject({
      status: 404,
      message: 'Групу не знайдено.',
    });
  });

  it('gives the Ukrainian 409 on a duplicate name', async () => {
    const { prisma, service } = shop();
    prisma.merchGroup.create.mockRejectedValue(prismaError('P2002'));
    await expect(service.createGroup('Куратори')).rejects.toMatchObject({
      status: 409,
      message: 'Група з такою назвою вже існує.',
    });
  });

  it('adds members and reports what it refused', async () => {
    const { prisma, service } = shop();
    prisma.merchGroupMember.createMany.mockResolvedValue({ count: 2 });

    await expect(
      service.addMembers(1, '26, @Good_User; bad-name'),
    ).resolves.toEqual({ added: 2, refused: ['bad-name'] });

    expect(prisma.merchGroupMember.createMany).toHaveBeenCalledWith({
      data: [
        { telegramId: 26n, groupId: 1 },
        { username: 'good_user', groupId: 1 },
      ],
      skipDuplicates: true,
    });
  });

  it('answers 404 before adding to a missing group', async () => {
    const { prisma, service } = shop();
    prisma.merchGroup.count.mockResolvedValue(0);
    await expect(service.addMembers(1, '26')).rejects.toMatchObject({
      status: 404,
      message: 'Групу не знайдено.',
    });
    expect(prisma.merchGroupMember.createMany).not.toHaveBeenCalled();
  });

  it('removes a member of that group only', async () => {
    const { prisma, service } = shop();
    await expect(service.removeMember(1, 2)).resolves.toEqual({ ok: true });
    expect(prisma.merchGroupMember.deleteMany).toHaveBeenCalledWith({
      where: { id: 2, groupId: 1 },
    });
    prisma.merchGroupMember.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.removeMember(1, 2)).rejects.toMatchObject({
      status: 404,
      message: 'Учасника не знайдено.',
    });
  });
});

describe('MerchAdminService slots', () => {
  it('deactivates a slot with orders', async () => {
    const { prisma, service } = shop();
    prisma.merchOrder.count.mockResolvedValue(2);

    await expect(service.deleteSlot(1)).resolves.toEqual({
      ok: true,
      deactivated: true,
    });

    expect(prisma.merchPickupSlot.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isActive: false },
    });
    expect(prisma.merchPickupSlot.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes a slot without orders', async () => {
    const { prisma, service } = shop();
    await expect(service.deleteSlot(1)).resolves.toEqual({
      ok: true,
      deactivated: false,
    });
    expect(prisma.merchPickupSlot.deleteMany).toHaveBeenCalledWith({
      where: { id: 1 },
    });
  });

  it('answers 404 for a missing slot', async () => {
    const { prisma, service } = shop();
    prisma.merchPickupSlot.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.deleteSlot(1)).rejects.toMatchObject({
      status: 404,
      message: 'Слот не знайдено.',
    });
  });

  it('creates a slot with a real date', async () => {
    const { prisma, service } = shop();
    await service.createSlot({
      date: '2026-11-12',
      startTime: '12:00',
      endTime: '14:00',
    });
    expect(prisma.merchPickupSlot.create).toHaveBeenCalledWith(
      data({
        date: new Date('2026-11-12T00:00:00.000Z'),
        startTime: '12:00',
        endTime: '14:00',
      }),
    );
  });

  it.each([
    ['2026-02-30', '12:00', '14:00', 'Некоректна дата або час.'],
    ['2026-11-12', '25:00', '26:00', 'Некоректна дата або час.'],
    ['2026-11-12', '14:00', '12:00', 'Кінець має бути пізніше за початок.'],
  ])('refuses %s %s-%s', async (date, startTime, endTime, message) => {
    const { prisma, service } = shop();
    await expect(
      service.createSlot({ date, startTime, endTime }),
    ).rejects.toMatchObject({ status: 400, message });
    expect(prisma.merchPickupSlot.create).not.toHaveBeenCalled();
  });
});

describe('MerchAdminService state', () => {
  it('speaks the contract: strings for money, ids and dates', async () => {
    const { prisma, service } = shop();
    prisma.merchProduct.findMany.mockResolvedValue([
      {
        id: 1,
        title: 'Футболка',
        description: 'Опис',
        isActive: false,
        order: -1,
        categoryId: 2,
        tags: [{ tagId: 3 }],
        groups: [{ groupId: 4 }],
        variants: [
          {
            id: 5,
            size: 'M',
            color: 'Білий',
            price: new Prisma.Decimal('500.5'),
            stock: null,
            order: 0,
          },
        ],
        photos: [
          { id: 6, color: 'Білий', url: PHOTO, thumbUrl: THUMB, productId: 1 },
        ],
      },
    ]);
    prisma.merchCategory.findMany.mockResolvedValue([
      { id: 2, name: 'Футболки', order: 0, _count: { products: 1 } },
    ]);
    prisma.merchGroup.findMany.mockResolvedValue([
      {
        id: 4,
        name: 'Куратори',
        _count: { products: 1 },
        members: [
          { id: 7, telegramId: 1234567890123n, username: null },
          { id: 8, telegramId: null, username: 'dev_user' },
        ],
      },
    ]);
    prisma.merchPickupSlot.findMany.mockResolvedValue([
      {
        id: 9,
        date: new Date('2026-11-12T00:00:00.000Z'),
        startTime: '12:00',
        endTime: '14:00',
        isActive: true,
        _count: { orders: 2 },
      },
    ]);

    const state = await service.state();

    expect(state).toEqual({
      adminChatBound: true,
      products: [
        {
          id: 1,
          title: 'Футболка',
          description: 'Опис',
          isActive: false,
          order: -1,
          categoryId: 2,
          tagIds: [3],
          groupIds: [4],
          variants: [
            {
              id: 5,
              size: 'M',
              color: 'Білий',
              price: '500.50',
              stock: null,
              order: 0,
            },
          ],
          photos: [{ color: 'Білий', url: PHOTO, thumbUrl: THUMB }],
        },
      ],
      categories: [{ id: 2, name: 'Футболки', order: 0, products: 1 }],
      tags: [],
      groups: [
        {
          id: 4,
          name: 'Куратори',
          products: 1,
          members: [
            { id: 7, telegramId: '1234567890123', username: null },
            { id: 8, telegramId: null, username: 'dev_user' },
          ],
        },
      ],
      templates: [],
      slots: [
        {
          id: 9,
          date: '2026-11-12',
          startTime: '12:00',
          endTime: '14:00',
          isActive: true,
          orders: 2,
        },
      ],
    });
    expect(prisma.merchProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ order: 'asc' }, { id: 'desc' }] }),
    );
    expect(prisma.merchPickupSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
      }),
    );
  });

  it('says when no admin chat is bound', async () => {
    const { service } = shop(null);
    await expect(service.state()).resolves.toMatchObject({
      adminChatBound: false,
    });
  });
});

describe('MerchAdminGuard', () => {
  const context = (headers: Record<string, string>) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ headers }) }),
    }) as unknown as ExecutionContext;

  const guard = (env: Record<string, string>, isShopAdmin: jest.Mock) =>
    new MerchAdminGuard(
      { get: (key: string) => env[key] } as unknown as ConfigService,
      { isShopAdmin } as never,
    );

  beforeEach(() => {
    resolveUser.mockReset().mockReturnValue({
      telegramId: 1001n,
      staffName: 'Адмін',
    });
  });

  it('sits on the controller class, so no route can forget it', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      MerchAdminController,
    ) as unknown[];
    expect(guards).toContain(MerchAdminGuard);
  });

  it('checks init data of the merch bot and the bound chat', async () => {
    const isShopAdmin = jest.fn().mockResolvedValue(true);
    const headers = { 'x-telegram-init-data': 'signed' };

    await expect(
      guard({}, isShopAdmin).canActivate(context(headers)),
    ).resolves.toBe(true);

    expect(resolveUser).toHaveBeenCalledWith(
      expect.anything(),
      'signed',
      undefined,
      ['MERCH_BOT_TOKEN'],
    );
    expect(isShopAdmin).toHaveBeenCalledWith(1001);
  });

  it('answers 403 to a member', async () => {
    const check = guard({}, jest.fn().mockResolvedValue(false));
    await expect(check.canActivate(context({}))).rejects.toThrow(
      new ForbiddenException('Немає доступу до адмінки.'),
    );
  });

  it('passes on a 401 from init data and never asks Telegram', async () => {
    const isShopAdmin = jest.fn();
    resolveUser.mockImplementation(() => {
      throw new UnauthorizedException('Відсутні дані авторизації Telegram');
    });
    await expect(
      guard({}, isShopAdmin).canActivate(context({ 'x-merch-token': 'web' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(isShopAdmin).not.toHaveBeenCalled();
  });

  it('passes on a 503 from Telegram, never "no access"', async () => {
    const failure = new ServiceUnavailableException('Telegram');
    const check = guard({}, jest.fn().mockRejectedValue(failure));
    await expect(check.canActivate(context({}))).rejects.toBe(failure);
  });

  it('lets local runs through with AUTH_DISABLED', async () => {
    const isShopAdmin = jest.fn();
    await expect(
      guard({ AUTH_DISABLED: 'true' }, isShopAdmin).canActivate(context({})),
    ).resolves.toBe(true);
    expect(resolveUser).not.toHaveBeenCalled();
    expect(isShopAdmin).not.toHaveBeenCalled();
  });
});
