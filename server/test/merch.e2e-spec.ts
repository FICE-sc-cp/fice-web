/**
 * Locks and constraints of the merch shop on real Postgres, which fakes cannot
 * prove. Needs a throwaway database with the migrations applied:
 *
 *   DATABASE_URL=postgresql://... UPLOAD_DIR=<scratch> npx jest --config test/jest-e2e.json merch
 *
 * It wipes merch data. Never point it at a database you care about.
 */
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { MerchBotService } from '../src/bot/merch-bot.service';
import { PrismaService } from '../src/database/prisma.service';
import { MerchAdminService } from '../src/modules/merch/merch-admin.service';
import {
  MerchCatalogService,
  Viewer,
} from '../src/modules/merch/merch-catalog.service';
import { MerchOrderService } from '../src/modules/merch/merch-order.service';
import { MerchSyncService } from '../src/modules/merch/merch-sync.service';
import { CreateOrderDto, ProductDto } from '../src/modules/merch/merch.dto';
import { PublicUploadService } from '../src/upload/public-upload.service';
import { UPLOAD_DIR } from '../src/upload/upload.constants';

const prisma = new PrismaService();
const shopBot = {
  enabled: false,
  getUsername: () => 'merch_test_bot',
  shopConfig: () => prisma.merchConfig.findUniqueOrThrow({ where: { id: 1 } }),
  kick: () => {},
} as unknown as MerchBotService;
const config = { get: () => undefined } as never;

const catalog = new MerchCatalogService(prisma, config, shopBot);
const orders = new MerchOrderService(prisma, catalog, shopBot);
const admin = new MerchAdminService(prisma, shopBot);
const sync = new MerchSyncService(prisma, shopBot, config);
const uploads = new PublicUploadService(prisma);

const files: string[] = [];

function upload(): string {
  const name = `${randomUUID()}.jpg`;
  writeFileSync(join(UPLOAD_DIR, name), 'x');
  files.push(join(UPLOAD_DIR, name));
  return `/uploads/${name}`;
}

async function wipe() {
  await prisma.merchOrder.deleteMany();
  await prisma.merchPickupSlot.deleteMany();
  await prisma.merchProduct.deleteMany();
  await prisma.merchGroup.deleteMany();
  await prisma.merchCategory.deleteMany();
  await prisma.merchTag.deleteMany();
  await prisma.merchCustomer.deleteMany();
  await prisma.publicUpload.deleteMany();
}

const buyer = (id: number): Viewer => ({
  telegramId: BigInt(100_000 + id),
  firstName: `Тест ${id}`,
});

const order = (
  lines: { variantId: number; quantity: number }[],
  expectedTotal = '0.00',
  clientKey: string = randomUUID(),
): CreateOrderDto => ({
  clientKey,
  lines: lines.map((l) => ({ ...l, label: 'Тест' })),
  expectedTotal,
  delivery: 'LATER_CAMPUS',
  recipientName: 'Тестовий Отримувач',
  recipientPhone: '+380501112233',
  receiptUrl: upload(),
});

/** One product with one variant per stock value. */
async function product(stocks: (number | null)[], price = '100.00') {
  const created = await prisma.merchProduct.create({
    data: {
      title: 'Тестова футболка',
      description: 'Опис',
      variants: {
        create: stocks.map((stock, i) => ({
          size: `S${i}`,
          price,
          stock,
          order: i * 100,
        })),
      },
    },
    include: { variants: { orderBy: { order: 'asc' } } },
  });
  return created;
}

const stockOf = async (id: number) =>
  (await prisma.merchVariant.findUniqueOrThrow({ where: { id } })).stock;

beforeAll(async () => {
  mkdirSync(UPLOAD_DIR, { recursive: true });
  await prisma.$connect();
});

beforeEach(wipe);

afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
  for (const file of files) if (existsSync(file)) unlinkSync(file);
});

describe('catalog and product SQL', () => {
  async function seed() {
    const hoodies = await prisma.merchCategory.create({
      data: { name: 'Худі', order: 1 },
    });
    const closed = await prisma.merchCategory.create({
      data: { name: 'Закрите', order: 2 },
    });
    const preorder = await prisma.merchTag.create({
      data: { name: 'Передзамовлення' },
    });
    const curators = await prisma.merchGroup.create({
      data: { name: 'Куратори' },
    });
    const shirt = await prisma.merchProduct.create({
      data: {
        title: 'Футболка',
        description: 'Опис',
        order: 0,
        categoryId: hoodies.id,
        tags: { create: [{ tagId: preorder.id }] },
        variants: {
          create: [
            { size: 'S', color: 'Білий', price: '400.00', stock: 0, order: 0 },
            { size: 'S', color: 'Чорний', price: '500.50', stock: 3, order: 1 },
            {
              size: 'M',
              color: 'Білий',
              price: '400.00',
              stock: 0,
              order: 100,
            },
            { size: 'M', color: 'Чорний', price: '600.00', order: 101 },
          ],
        },
        photos: {
          create: [
            {
              color: 'Білий',
              url: '/uploads/w.jpg',
              thumbUrl: '/uploads/w-t.jpg',
            },
            {
              color: 'Чорний',
              url: '/uploads/b.jpg',
              thumbUrl: '/uploads/b-t.jpg',
            },
          ],
        },
      },
    });
    const sticker = await prisma.merchProduct.create({
      data: {
        title: 'Наліпка',
        description: 'Опис',
        order: -1,
        variants: { create: [{ size: '-', price: '50.00', stock: 0 }] },
      },
    });
    const hidden = await prisma.merchProduct.create({
      data: {
        title: 'Кураторський светр',
        description: 'Опис',
        order: -2,
        categoryId: closed.id,
        groups: { create: [{ groupId: curators.id }] },
        variants: { create: [{ size: 'L', price: '900.00', stock: 5 }] },
      },
    });
    return { hoodies, closed, preorder, curators, shirt, sticker, hidden };
  }

  it('answers an anonymous viewer with an empty group list', async () => {
    const s = await seed();

    const anon = await catalog.catalog([]);

    expect(anon).toEqual({
      products: [
        {
          id: s.sticker.id,
          title: 'Наліпка',
          categoryId: null,
          tagIds: [],
          thumbUrl: null,
          minPrice: '50.00',
          soldOut: true,
        },
        {
          id: s.shirt.id,
          title: 'Футболка',
          categoryId: s.hoodies.id,
          tagIds: [s.preorder.id],
          // White is sold out, so black is the default colour and its thumb.
          thumbUrl: '/uploads/b-t.jpg',
          minPrice: '500.50',
          soldOut: false,
        },
      ],
      categories: [{ id: s.hoodies.id, name: 'Худі' }],
      tags: [{ id: s.preorder.id, name: 'Передзамовлення' }],
      botUsername: 'merch_test_bot',
    });
  });

  it('adds a restricted product and its chip for a member', async () => {
    const s = await seed();

    const member = await catalog.catalog([s.curators.id]);

    expect(member.products.map((p) => p.id)).toEqual([
      s.hidden.id,
      s.sticker.id,
      s.shirt.id,
    ]);
    expect(member.categories.map((c) => c.name)).toEqual(['Худі', 'Закрите']);
  });

  it('reads a product into the ProductView shape', async () => {
    const s = await seed();

    const view = await catalog.product(s.shirt.id, []);

    expect(view).toMatchObject({
      id: s.shirt.id,
      title: 'Футболка',
      archived: false,
      categoryId: s.hoodies.id,
      tagIds: [s.preorder.id],
      colors: ['Білий', 'Чорний'],
      sizes: ['S', 'M'],
      fixedSize: null,
      defaultColor: 'Чорний',
      minPrice: '500.50',
      botUsername: 'merch_test_bot',
    });
    expect(view.variants).toHaveLength(4);
    expect(view.variants[1]).toEqual({
      id: expect.any(Number) as number,
      size: 'S',
      color: 'Чорний',
      price: '500.50',
      stock: 3,
    });
    expect(view.photos.map((p) => p.color)).toEqual(['Білий', 'Чорний']);
  });

  it('hides a restricted product from outsiders', async () => {
    const s = await seed();

    await expect(catalog.product(s.hidden.id, [])).rejects.toMatchObject({
      status: 404,
    });
    expect((await catalog.product(s.hidden.id, [s.curators.id])).title).toBe(
      'Кураторський светр',
    );
  });
});

describe('orders under load', () => {
  it('takes 20 concurrent orders on a stock of 5', async () => {
    const { variants } = await product([5]);
    const [{ id: variantId }] = variants;

    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        orders.createOrder(
          buyer(i),
          order([{ variantId, quantity: 1 }], '100.00'),
          [],
        ),
      ),
    );

    expect(new Set(results.map((r) => r.id)).size).toBe(20);
    expect(await stockOf(variantId)).toBe(0);
    const items = await prisma.merchOrderItem.findMany();
    expect(items.reduce((sum, item) => sum + item.stockTaken, 0)).toBe(5);
    const all = await prisma.merchOrder.findMany();
    expect(all.filter((o) => o.warnings.length).length).toBe(15);
  }, 30_000);

  it('makes one order of a key sent 5 times at once', async () => {
    const { variants } = await product([5]);
    const [{ id: variantId }] = variants;
    const body = order([{ variantId, quantity: 1 }], '100.00');

    const results = await Promise.all(
      Array.from({ length: 5 }, () => orders.createOrder(buyer(1), body, [])),
    );

    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(results.filter((r) => !r.repeated)).toHaveLength(1);
    expect(await prisma.merchOrder.count()).toBe(1);
    expect(await stockOf(variantId)).toBe(4);
  });

  it('finishes two orders of the same variants in opposite line order', async () => {
    const { variants } = await product([50, 50]);
    const [a, b] = variants.map((v) => v.id);

    for (let round = 0; round < 10; round++) {
      await Promise.all([
        orders.createOrder(
          buyer(round + 100),
          order(
            [
              { variantId: a, quantity: 1 },
              { variantId: b, quantity: 1 },
            ],
            '200.00',
          ),
          [],
        ),
        orders.createOrder(
          buyer(round + 200),
          order(
            [
              { variantId: b, quantity: 1 },
              { variantId: a, quantity: 1 },
            ],
            '200.00',
          ),
          [],
        ),
      ]);
    }

    expect(await prisma.merchOrder.count()).toBe(20);
    expect(await stockOf(a)).toBe(30);
    expect(await stockOf(b)).toBe(30);
  }, 30_000);

  it('returns stock once when cancel is pressed twice at once', async () => {
    const { variants } = await product([5]);
    const [{ id: variantId }] = variants;
    const { id } = await orders.createOrder(
      buyer(1),
      order([{ variantId, quantity: 2 }], '200.00'),
      [],
    );
    expect(await stockOf(variantId)).toBe(3);

    const answers = await Promise.all([
      sync.changeStatus(id, 'CANCELLED', 'Адмін'),
      sync.changeStatus(id, 'CANCELLED', 'Адмін'),
    ]);

    expect(await stockOf(variantId)).toBe(5);
    expect(answers.map((a) => a.text).sort()).toEqual([
      'Статус змінено: ❌ Скасовано',
      'Цей статус вже встановлено',
    ]);
  });

  /** The form loaded 10 and the admin typed 12. */
  const staleSave = (size: string): ProductDto => ({
    saveKey: randomUUID(),
    seenKey: null,
    title: 'Нова назва',
    description: 'Опис',
    tagIds: [],
    groupIds: [],
    photos: [],
    variants: [
      {
        size,
        color: '',
        price: '100.00',
        order: 0,
        stockSeen: 10,
        stock: 12,
      },
    ],
  });

  it('applies the difference of a stale admin save during orders', async () => {
    const { id, variants } = await product([10]);
    const [variant] = variants;

    await Promise.all([
      orders.createOrder(
        buyer(1),
        order([{ variantId: variant.id, quantity: 1 }], '100.00'),
        [],
      ),
      admin.updateProduct(id, staleSave(variant.size)),
      orders.createOrder(
        buyer(2),
        order([{ variantId: variant.id, quantity: 2 }], '200.00'),
        [],
      ),
    ]);

    // Two added by hand, three sold: nothing lost, in whatever order the locks fell.
    expect(await stockOf(variant.id)).toBe(9);
    expect(await prisma.merchVariant.count({ where: { productId: id } })).toBe(
      1,
    );
  });

  it('waits for a sale in flight, so a save cannot overwrite it', async () => {
    const { id, variants } = await product([10]);
    const [variant] = variants;
    let saving: Promise<unknown> = Promise.resolve();

    // What an order holds between its read and its commit. Without the lock in the
    // save it would read 10 here, write 12 after the commit, and lose the sale.
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "MerchVariant" WHERE id = ${variant.id} FOR UPDATE`;
      await tx.merchVariant.update({
        where: { id: variant.id },
        data: { stock: 7 },
      });
      saving = admin.updateProduct(id, staleSave(variant.size));
      await new Promise((done) => setTimeout(done, 300));
    });
    await saving;

    expect(await stockOf(variant.id)).toBe(9);
  });

  it('moves stock once when a lost response makes the form save again', async () => {
    const { id, variants } = await product([10]);
    const save = staleSave(variants[0].size);

    await Promise.all([
      admin.updateProduct(id, save),
      admin.updateProduct(id, save),
    ]);
    await admin.updateProduct(id, save);

    expect(await stockOf(variants[0].id)).toBe(12);
  });

  it('refuses a form that loaded before another save', async () => {
    const { id, variants } = await product([10]);
    await admin.updateProduct(id, staleSave(variants[0].size));

    await expect(
      admin.updateProduct(id, staleSave(variants[0].size)),
    ).rejects.toMatchObject({ status: 409 });
    expect(await stockOf(variants[0].id)).toBe(12);
  });

  it('makes one product of a create sent 5 times at once', async () => {
    const { variants } = await product([10]);
    const save = staleSave(variants[0].size);

    const answers = await Promise.all(
      Array.from({ length: 5 }, () => admin.createProduct(save)),
    );

    expect(new Set(answers.map((a) => a.id)).size).toBe(1);
    expect(
      await prisma.merchProduct.count({ where: { saveKey: save.saveKey } }),
    ).toBe(1);
  });
});

describe('recipients', () => {
  it('stops at the cap under 5 saves at once, and an order still goes through', async () => {
    const me = buyer(1);
    await catalog.addRecipient(me, { fullName: 'Перший', phone: '0501234567' });
    await prisma.merchRecipient.createMany({
      data: Array.from({ length: 18 }, (_, i) => ({
        telegramId: me.telegramId,
        fullName: `Отримувач ${i}`,
        phone: '+380501234567',
      })),
    });

    const saves = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) =>
        catalog.addRecipient(me, {
          fullName: `Новий ${i}`,
          phone: '0501234567',
        }),
      ),
    );

    expect(saves.filter((s) => s.status === 'fulfilled')).toHaveLength(1);
    const owned = { where: { telegramId: me.telegramId } };
    expect(await prisma.merchRecipient.count(owned)).toBe(20);

    const { variants } = await product([5]);
    const created = await orders.createOrder(
      me,
      {
        ...order([{ variantId: variants[0].id, quantity: 1 }], '100.00'),
        recipientId: undefined,
        recipientName: 'Ще один',
        recipientPhone: '0501234567',
        saveRecipient: true,
      },
      [],
    );
    expect(created.repeated).toBe(false);
    expect(await prisma.merchRecipient.count(owned)).toBe(20);
  });
});

describe('database constraints', () => {
  it('refuses a negative stock', async () => {
    const { variants } = await product([1]);

    await expect(
      prisma.$executeRaw`UPDATE "MerchVariant" SET stock = -1 WHERE id = ${variants[0].id}`,
    ).rejects.toThrow(/MerchVariant_stock_not_negative/);
  });

  it('refuses a second config row', async () => {
    await expect(
      prisma.$executeRaw`INSERT INTO "MerchConfig" (id) VALUES (2)`,
    ).rejects.toThrow(/MerchConfig_single_row/);
  });
});

describe('public upload GC', () => {
  it('keeps a merch receipt and photo, takes an unreferenced upload', async () => {
    const now = new Date();
    const record = async (url: string) => {
      const filename = url.replace('/uploads/', '');
      await prisma.publicUpload.create({
        data: {
          filename,
          size: 1,
          ipHash: 'merch-admin',
          createdAt: now,
          unreferencedSince: now,
        },
      });
      return join(UPLOAD_DIR, filename);
    };
    const receiptUrl = upload();
    const photoUrl = upload();
    const thumbUrl = upload();
    const strayUrl = upload();
    const receipt = await record(receiptUrl);
    const photo = await record(photoUrl);
    const thumb = await record(thumbUrl);
    const stray = await record(strayUrl);

    const { id: productId } = await product([1]);
    await prisma.merchPhoto.create({
      data: { productId, url: photoUrl, thumbUrl },
    });
    await prisma.merchOrder.create({
      data: {
        customer: { create: { telegramId: 500n } },
        address: 'Кабінет',
        phone: '+380501112233',
        totalAmount: '100.00',
        receiptUrl,
      },
    });

    const result = await uploads.collectGarbage(
      new Date(now.getTime() + 2 * 24 * 60 * 60_000),
    );

    expect(result).toMatchObject({ deleted: 1, referenced: 3 });
    expect(existsSync(receipt)).toBe(true);
    expect(existsSync(photo)).toBe(true);
    expect(existsSync(thumb)).toBe(true);
    expect(existsSync(stray)).toBe(false);
  });
});
