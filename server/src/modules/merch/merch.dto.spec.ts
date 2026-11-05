import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CartDto,
  CreateOrderDto,
  GroupDto,
  IdsDto,
  OrderLineDto,
  PickupDto,
  ProductDto,
  RecipientDto,
  TemplateDto,
  VariantDto,
} from './merch.dto';

const refused = async (cls: new () => object, body: object) => {
  const errors = await validate(plainToInstance(cls, body));
  return errors.map((e) => e.property);
};

const ABSURD = [2 ** 31, 1e21, -(2 ** 40)];

describe('nested lists in merch DTOs', () => {
  const line = { variantId: 1, quantity: 1, label: 'a' };

  it('refuses an array in place of a line', async () => {
    expect(await refused(CartDto, { lines: [[line]] })).toEqual(['lines']);
    expect(await refused(CreateOrderDto, { lines: [[line]] })).toContain(
      'lines',
    );
  });

  it('refuses an array in place of a variant, photo or price', async () => {
    const errors = await refused(ProductDto, {
      variants: [[{}]],
      photos: [[{}]],
    });
    expect(errors).toEqual(expect.arrayContaining(['variants', 'photos']));
    expect(await refused(TemplateDto, { prices: [[{}]] })).toContain('prices');
  });
});

describe('NUL in merch text', () => {
  const NUL = 'a\u0000b';

  it.each<[string, new () => object, object, string]>([
    [
      'a recipient name',
      RecipientDto,
      { fullName: NUL, phone: '1' },
      'fullName',
    ],
    ['a recipient phone', RecipientDto, { fullName: 'a', phone: NUL }, 'phone'],
    [
      'a line label',
      OrderLineDto,
      { variantId: 1, quantity: 1, label: NUL },
      'label',
    ],
    ['a group name', GroupDto, { name: NUL }, 'name'],
  ])('refuses %s', async (_name, dto, body, field) => {
    expect(await refused(dto, body)).toEqual([field]);
  });

  it.each(['recipientName', 'recipientPhone', 'address'])(
    'refuses %s on an order',
    async (field) => {
      expect(await refused(CreateOrderDto, { [field]: NUL })).toContain(field);
    },
  );

  it('refuses it in a list of strings and keeps a plain line break', async () => {
    expect(await refused(TemplateDto, { colors: [NUL] })).toContain('colors');
    expect(
      await refused(ProductDto, { title: 'a', description: 'a\nb' }),
    ).not.toEqual(expect.arrayContaining(['title', 'description']));
  });
});

describe('row ids in merch DTOs', () => {
  it.each(ABSURD)('refuses %d in a cart line', async (variantId) => {
    expect(
      await refused(CartDto, { lines: [{ variantId, quantity: 1 }] }),
    ).toEqual(['lines']);
  });

  it('takes the largest id Postgres can hold', async () => {
    const body = { lines: [{ variantId: 2 ** 31 - 1, quantity: 1 }] };
    expect(await refused(CartDto, body)).toEqual([]);
  });

  it.each(ABSURD)('refuses %d as a recipient', async (recipientId) => {
    expect(await refused(CreateOrderDto, { recipientId })).toContain(
      'recipientId',
    );
  });

  it.each(ABSURD)('refuses %d as a pickup slot', async (pickupSlotId) => {
    expect(
      await refused(PickupDto, { pickupSlotId, needsIndividualPickup: false }),
    ).toEqual(['pickupSlotId']);
  });

  it('keeps a null slot for individual pickup', async () => {
    expect(
      await refused(PickupDto, {
        pickupSlotId: null,
        needsIndividualPickup: true,
      }),
    ).toEqual([]);
  });

  it.each(ABSURD)('refuses %d in a reorder', async (id) => {
    expect(await refused(IdsDto, { ids: [1, id] })).toEqual(['ids']);
  });

  it.each(ABSURD)('refuses %d among product labels', async (id) => {
    const errors = await refused(ProductDto, {
      categoryId: id,
      tagIds: [id],
      groupIds: [id],
    });
    expect(errors).toEqual(
      expect.arrayContaining(['categoryId', 'tagIds', 'groupIds']),
    );
  });

  it('keeps a null category', async () => {
    expect(await refused(ProductDto, { categoryId: null })).not.toContain(
      'categoryId',
    );
  });

  it('bounds the numbers of a variant that land in int4 columns', async () => {
    const body = { size: 'M', color: '', price: '1.00', order: 2 ** 31 };
    expect(await refused(VariantDto, body)).toEqual(['order']);
    expect(
      await refused(VariantDto, { ...body, order: 0, stockSeen: 2 ** 31 }),
    ).toEqual(['stockSeen']);
  });
});
