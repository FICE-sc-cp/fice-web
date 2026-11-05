import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MerchBotService } from '../../bot/merch-bot.service';
import { PrismaService } from '../../database/prisma.service';
import { OWN_IMAGE_URL, ownUploadExists } from '../../upload/own-upload';
import {
  diffVariants,
  fromKopecks,
  normalizeVariants,
  parseMemberValues,
  ProductPhoto,
  ProductVariant,
  redistribute,
  slotDate,
  slotDay,
  slotProblem,
  templateProblem,
  toKopecks,
  topOrder,
  variantProblem,
  VariantRow,
} from './merch-rules';
import { ProductDto, SlotDto, TemplateDto } from './merch.dto';

// LabelKind and AdminState mirror client/web/lib/merch-types.ts.

export type LabelKind = 'category' | 'tag';

interface AdminLabel {
  id: number;
  name: string;
  order: number;
  products: number;
}

interface TemplatePrice {
  size: string;
  color: string;
  price: string;
}

export interface AdminState {
  adminChatBound: boolean;
  products: {
    id: number;
    title: string;
    description: string;
    isActive: boolean;
    order: number;
    saveKey: string | null;
    categoryId: number | null;
    tagIds: number[];
    groupIds: number[];
    variants: (ProductVariant & { order: number })[];
    photos: ProductPhoto[];
  }[];
  categories: AdminLabel[];
  tags: AdminLabel[];
  groups: {
    id: number;
    name: string;
    products: number;
    members: {
      id: number;
      telegramId: string | null;
      username: string | null;
    }[];
  }[];
  templates: {
    id: number;
    name: string;
    categoryId: number | null;
    description: string;
    tagIds: number[];
    groupIds: number[];
    sizes: string[];
    colors: string[];
    prices: TemplatePrice[];
  }[];
  slots: {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    isActive: boolean;
    orders: number;
  }[];
}

interface ProductInput {
  fields: { title: string; description: string; categoryId: number | null };
  rows: VariantRow[];
  tagIds: number[];
  groupIds: number[];
  photos: ProductPhoto[];
}

/** What a reorder needs; products and both label tables all fit. */
interface OrderedTable {
  findMany(args: {
    where: { id: { in: number[] } };
    select: { id: true; order: true };
  }): PromiseLike<{ id: number; order: number }[]>;
  updateMany(args: {
    where: { id: number };
    data: { order: number };
  }): PromiseLike<unknown>;
}

const PRODUCT_NOT_FOUND = 'Товар не знайдено.';
const TEMPLATE_NOT_FOUND = 'Шаблон не знайдено.';
const GROUP_NOT_FOUND = 'Групу не знайдено.';
const LABEL_NOT_FOUND = 'Не знайдено';
const LABEL_TAKEN = 'Така назва вже існує.';
const TEMPLATE_TAKEN = 'Шаблон з такою назвою вже існує.';
const GROUP_TAKEN = 'Група з такою назвою вже існує.';
const DEAD_REFERENCE =
  'Категорію, тег або групу вже видалено. Оновіть сторінку.';
const STALE_FORM =
  'Цей товар щойно змінив інший адмін. Вийдіть і відкрийте його знову, щоб не затерти зміни.';

/** A save is up to 300 variant updates, a reorder up to 1000, one statement each. */
const LONG_TX = { timeout: 15_000 };

const LABEL_QUERY = {
  orderBy: [{ order: 'asc' }, { id: 'asc' }],
  include: { _count: { select: { products: true } } },
} satisfies Prisma.MerchTagFindManyArgs;

const isPrismaError = (err: unknown, code: string) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;

/** P2002 becomes the Ukrainian 409, because the global filter prints English. */
async function unique<T>(write: PromiseLike<T>, taken: string): Promise<T> {
  try {
    return await write;
  } catch (err) {
    if (isPrismaError(err, 'P2002')) throw new ConflictException(taken);
    throw err;
  }
}

/** @IsNotEmpty lets "  " through, so the trimmed value is checked here. */
function trimmed(value: string, problem: string): string {
  const text = value.trim();
  if (!text) throw new BadRequestException(problem);
  return text;
}

// ponytail: cast, because TS cannot call a method on a union of generic Prisma delegates.
// Both models have the same id, name, order and products, so one delegate type is right at runtime.
const labelTable = (db: Prisma.TransactionClient, kind: LabelKind) =>
  (kind === 'category'
    ? db.merchCategory
    : db.merchTag) as unknown as Prisma.MerchTagDelegate;

const labelView = (row: {
  id: number;
  name: string;
  order: number;
  _count: { products: number };
}): AdminLabel => ({
  id: row.id,
  name: row.name,
  order: row.order,
  products: row._count.products,
});

/** Products, labels, templates, groups and slots for the Mini App admin screens. */
@Injectable()
export class MerchAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: MerchBotService,
  ) {}

  // ponytail: the whole shop in one response keeps each screen to one fetch. A few
  // hundred products are fine; split it by screen if the admin ever feels slow.
  async state(): Promise<AdminState> {
    const [shop, products, categories, tags, groups, templates, slots] =
      await Promise.all([
        this.bot.shopConfig(),
        this.prisma.merchProduct.findMany({
          orderBy: [{ order: 'asc' }, { id: 'desc' }],
          include: {
            variants: { orderBy: [{ order: 'asc' }, { id: 'asc' }] },
            photos: { orderBy: { id: 'asc' } },
            tags: { select: { tagId: true } },
            groups: { select: { groupId: true } },
          },
        }),
        this.prisma.merchCategory.findMany(LABEL_QUERY),
        this.prisma.merchTag.findMany(LABEL_QUERY),
        this.prisma.merchGroup.findMany({
          orderBy: { id: 'asc' },
          include: {
            members: { orderBy: { id: 'asc' } },
            _count: { select: { products: true } },
          },
        }),
        this.prisma.merchTemplate.findMany({ orderBy: { id: 'asc' } }),
        this.prisma.merchPickupSlot.findMany({
          orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
          include: { _count: { select: { orders: true } } },
        }),
      ]);
    return {
      adminChatBound: shop.adminChatId !== null,
      products: products.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        isActive: p.isActive,
        order: p.order,
        saveKey: p.saveKey,
        categoryId: p.categoryId,
        tagIds: p.tags.map((t) => t.tagId),
        groupIds: p.groups.map((g) => g.groupId),
        variants: p.variants.map((v) => ({
          id: v.id,
          size: v.size,
          color: v.color,
          price: v.price.toFixed(2),
          stock: v.stock,
          order: v.order,
        })),
        photos: p.photos.map(({ color, url, thumbUrl }) => ({
          color,
          url,
          thumbUrl,
        })),
      })),
      categories: categories.map(labelView),
      tags: tags.map(labelView),
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        products: g._count.products,
        members: g.members.map((m) => ({
          id: m.id,
          telegramId: m.telegramId?.toString() ?? null,
          username: m.username,
        })),
      })),
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        categoryId: t.categoryId,
        description: t.description,
        tagIds: t.tagIds,
        groupIds: t.groupIds,
        sizes: t.sizes,
        colors: t.colors,
        prices: t.prices as unknown as TemplatePrice[],
      })),
      slots: slots.map((s) => ({
        id: s.id,
        date: slotDay(s.date),
        startTime: s.startTime,
        endTime: s.endTime,
        isActive: s.isActive,
        orders: s._count.orders,
      })),
    };
  }

  // ---- Products -------------------------------------------------------------

  /** A repeated saveKey is the same product, so a lost response cannot make a second one. */
  async createProduct(dto: ProductDto): Promise<{ id: number }> {
    const { saveKey } = dto;
    const saved = () =>
      this.prisma.merchProduct.findUnique({
        where: { saveKey },
        select: { id: true },
      });
    const repeat = await saved();
    if (repeat) return repeat;
    const input = await this.productInput(dto);
    try {
      const id = await this.saving(async (tx) => {
        const { _min } = await tx.merchProduct.aggregate({
          _min: { order: true },
        });
        const { id } = await tx.merchProduct.create({
          data: { ...input.fields, saveKey, order: topOrder(_min.order) },
          select: { id: true },
        });
        await this.writeParts(tx, id, input);
        return id;
      });
      return { id };
    } catch (err) {
      // Two at once: the loser's transaction rolled back whole.
      const winner = isPrismaError(err, 'P2002') ? await saved() : null;
      if (winner) return winner;
      throw err;
    }
  }

  /**
   * saveKey names the last save. Equal to this request's key, it is a retry of a
   * save that landed, so stock moves once. Different from what the form loaded,
   * someone saved since and this form would revert them. Only a save changes it:
   * a sale, a reorder or an archive leaves the form valid.
   */
  async updateProduct(id: number, dto: ProductDto): Promise<{ ok: true }> {
    const input = await this.productInput(dto);
    await this.saving(async (tx) => {
      // The row lock queues two saves of one product, so the second one sees
      // the variants the first created.
      const [row] = await tx.$queryRaw<{ saveKey: string | null }[]>`
        SELECT "saveKey" FROM "MerchProduct" WHERE id = ${id} FOR UPDATE`;
      if (!row) throw new NotFoundException(PRODUCT_NOT_FOUND);
      if (row.saveKey === dto.saveKey) return;
      if (row.saveKey !== (dto.seenKey ?? null)) {
        throw new ConflictException(STALE_FORM);
      }
      await tx.merchProduct.update({
        where: { id },
        data: { ...input.fields, saveKey: dto.saveKey },
      });
      await this.writeParts(tx, id, input);
    });
    return { ok: true };
  }

  async setActive(id: number, isActive: boolean) {
    const { count } = await this.prisma.merchProduct.updateMany({
      where: { id },
      data: { isActive },
    });
    if (!count) throw new NotFoundException(PRODUCT_NOT_FOUND);
    return { ok: true as const, isActive };
  }

  /** Order lines keep their snapshots; files leave through the upload GC. */
  async deleteProduct(id: number): Promise<{ ok: true }> {
    const { count } = await this.prisma.merchProduct.deleteMany({
      where: { id },
    });
    if (!count) throw new NotFoundException(PRODUCT_NOT_FOUND);
    return { ok: true };
  }

  async reorderProducts(ids: number[]): Promise<{ ok: true }> {
    await this.prisma.$transaction(
      (tx) => this.reorder(tx.merchProduct, ids),
      LONG_TX,
    );
    return { ok: true };
  }

  /** Everything that can be refused, before any write. */
  private async productInput(dto: ProductDto): Promise<ProductInput> {
    const title = dto.title.trim();
    const description = dto.description.trim();
    if (!title || !description) {
      throw new BadRequestException('Заповніть назву та опис');
    }
    const rows = normalizeVariants(dto.variants);
    const problem = variantProblem(rows);
    if (problem) throw new BadRequestException(problem);
    const refs = await this.liveReferences(dto);
    // One photo per colour is the table's key; the last one sent wins.
    const photos = new Map<string, ProductPhoto>();
    for (const { color, url, thumbUrl } of dto.photos) {
      if (
        !ownUploadExists(url, OWN_IMAGE_URL) ||
        !ownUploadExists(thumbUrl, OWN_IMAGE_URL)
      ) {
        throw new BadRequestException(
          'Фото не знайдено. Завантажте його ще раз.',
        );
      }
      photos.set(color.trim(), { color: color.trim(), url, thumbUrl });
    }
    return {
      fields: { title, description, categoryId: refs.categoryId },
      rows,
      tagIds: refs.tagIds,
      groupIds: refs.groupIds,
      photos: [...photos.values()],
    };
  }

  /** Refused, never dropped: losing the only group of a curator product would make it public. */
  private async liveReferences(dto: {
    categoryId?: number | null;
    tagIds: number[];
    groupIds: number[];
  }) {
    const categoryId = dto.categoryId ?? null;
    const tagIds = [...new Set(dto.tagIds)];
    const groupIds = [...new Set(dto.groupIds)];
    const [categories, tags, groups] = await Promise.all([
      categoryId === null
        ? 0
        : this.prisma.merchCategory.count({ where: { id: categoryId } }),
      this.prisma.merchTag.count({ where: { id: { in: tagIds } } }),
      this.prisma.merchGroup.count({ where: { id: { in: groupIds } } }),
    ]);
    if (
      categories !== (categoryId === null ? 0 : 1) ||
      tags !== tagIds.length ||
      groups !== groupIds.length
    ) {
      throw new BadRequestException(DEAD_REFERENCE);
    }
    return { categoryId, tagIds, groupIds };
  }

  /** A label deleted after the check above fails its foreign key, with the same answer. */
  private async saving<T>(
    write: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(write, LONG_TX);
    } catch (err) {
      if (isPrismaError(err, 'P2003')) {
        throw new BadRequestException(DEAD_REFERENCE);
      }
      throw err;
    }
  }

  private async writeParts(
    tx: Prisma.TransactionClient,
    productId: number,
    input: ProductInput,
  ) {
    const existing = await tx.$queryRaw<
      { id: number; size: string; color: string; stock: number | null }[]
    >`SELECT id, size, color, stock FROM "MerchVariant" WHERE "productId" = ${productId} ORDER BY id FOR UPDATE`;
    const { update, create, remove } = diffVariants(existing, input.rows);
    for (const { id, ...data } of update) {
      await tx.merchVariant.update({ where: { id }, data });
    }
    await tx.merchVariant.deleteMany({ where: { id: { in: remove } } });
    await tx.merchVariant.createMany({
      data: create.map((variant) => ({ ...variant, productId })),
    });

    await tx.merchProductTag.deleteMany({ where: { productId } });
    await tx.merchProductTag.createMany({
      data: input.tagIds.map((tagId) => ({ productId, tagId })),
    });
    await tx.merchProductGroup.deleteMany({ where: { productId } });
    await tx.merchProductGroup.createMany({
      data: input.groupIds.map((groupId) => ({ productId, groupId })),
    });

    // A repeated import skips the download only while it finds its file id.
    const before = await tx.merchPhoto.findMany({
      where: { productId },
      select: { color: true, url: true, sourceFileId: true },
    });
    await tx.merchPhoto.deleteMany({ where: { productId } });
    await tx.merchPhoto.createMany({
      data: input.photos.map((photo) => ({
        ...photo,
        productId,
        sourceFileId: before.find(
          (p) => p.color === photo.color && p.url === photo.url,
        )?.sourceFileId,
      })),
    });
  }

  /** Works on the sent subset. Ids that no longer exist are dropped, not an error. */
  private async reorder(table: OrderedTable, ids: number[]) {
    const rows = await table.findMany({
      where: { id: { in: ids } },
      select: { id: true, order: true },
    });
    for (const { id, order } of redistribute(ids, rows)) {
      await table.updateMany({ where: { id }, data: { order } });
    }
  }

  // ---- Categories and tags --------------------------------------------------

  async createLabel(kind: LabelKind, raw: string): Promise<{ id: number }> {
    const name = trimmed(raw, 'Вкажіть назву.');
    const table = labelTable(this.prisma, kind);
    const { _max } = await table.aggregate({ _max: { order: true } });
    const { id } = await unique(
      table.create({
        data: { name, order: (_max.order ?? -1) + 1 },
        select: { id: true },
      }),
      LABEL_TAKEN,
    );
    return { id };
  }

  async renameLabel(
    kind: LabelKind,
    id: number,
    raw: string,
  ): Promise<{ ok: true }> {
    const name = trimmed(raw, 'Вкажіть назву.');
    const { count } = await unique(
      labelTable(this.prisma, kind).updateMany({
        where: { id },
        data: { name },
      }),
      LABEL_TAKEN,
    );
    if (!count) throw new NotFoundException(LABEL_NOT_FOUND);
    return { ok: true };
  }

  /** Products and templates lose the category; products lose the tag. */
  async deleteLabel(kind: LabelKind, id: number): Promise<{ ok: true }> {
    const { count } = await labelTable(this.prisma, kind).deleteMany({
      where: { id },
    });
    if (!count) throw new NotFoundException(LABEL_NOT_FOUND);
    return { ok: true };
  }

  async reorderLabels(kind: LabelKind, ids: number[]): Promise<{ ok: true }> {
    await this.prisma.$transaction(
      (tx) => this.reorder(labelTable(tx, kind), ids),
      LONG_TX,
    );
    return { ok: true };
  }

  // ---- Templates ------------------------------------------------------------

  async createTemplate(dto: TemplateDto): Promise<{ id: number }> {
    const { id } = await unique(
      this.prisma.merchTemplate.create({
        data: await this.templateData(dto),
        select: { id: true },
      }),
      TEMPLATE_TAKEN,
    );
    return { id };
  }

  async updateTemplate(id: number, dto: TemplateDto): Promise<{ ok: true }> {
    const { count } = await unique(
      this.prisma.merchTemplate.updateMany({
        where: { id },
        data: await this.templateData(dto),
      }),
      TEMPLATE_TAKEN,
    );
    if (!count) throw new NotFoundException(TEMPLATE_NOT_FOUND);
    return { ok: true };
  }

  async deleteTemplate(id: number): Promise<{ ok: true }> {
    const { count } = await this.prisma.merchTemplate.deleteMany({
      where: { id },
    });
    if (!count) throw new NotFoundException(TEMPLATE_NOT_FOUND);
    return { ok: true };
  }

  private async templateData(dto: TemplateDto) {
    const name = trimmed(dto.name, 'Вкажіть назву шаблону.');
    const sizes = dto.sizes.map((size) => size.trim().toUpperCase());
    const colors = dto.colors.map((color) => color.trim());
    const prices = dto.prices.map(({ size, color, price }) => ({
      size: size.trim().toUpperCase(),
      color: color.trim(),
      price: fromKopecks(toKopecks(price)),
    }));
    const problem = templateProblem({ sizes, colors, prices });
    if (problem) throw new BadRequestException(problem);
    return {
      name,
      description: dto.description.trim(),
      ...(await this.liveReferences(dto)),
      sizes,
      colors,
      prices,
    };
  }

  // ---- Groups ---------------------------------------------------------------

  async createGroup(raw: string): Promise<{ id: number }> {
    const name = trimmed(raw, 'Вкажіть назву групи.');
    const { id } = await unique(
      this.prisma.merchGroup.create({
        data: { name },
        select: { id: true },
      }),
      GROUP_TAKEN,
    );
    return { id };
  }

  /**
   * Refused while a product has only this group: the cascade would empty its
   * groupIds and productAccess would serve a curator product to anyone.
   */
  async deleteGroup(id: number): Promise<{ ok: true }> {
    await this.prisma.$transaction(async (tx) => {
      // The lock orders this against a product save: its new group row either
      // counts below or fails its foreign key.
      // ponytail: two groups deleted at the same instant can still empty a product
      // that had just those two. A table lock if that ever matters.
      const groups = await tx.$queryRaw<
        { id: number }[]
      >`SELECT id FROM "MerchGroup" WHERE id = ${id} FOR UPDATE`;
      if (!groups.length) throw new NotFoundException(GROUP_NOT_FOUND);
      const [{ n }] = await tx.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM "MerchProductGroup" g
        WHERE g."groupId" = ${id}
          AND NOT EXISTS (SELECT 1 FROM "MerchProductGroup" o
                          WHERE o."productId" = g."productId" AND o."groupId" <> ${id})`;
      if (n > 0) {
        throw new ConflictException(
          `Спочатку змініть або видаліть товари цієї групи: ${n}`,
        );
      }
      await tx.merchGroup.delete({ where: { id } });
    });
    return { ok: true };
  }

  async addMembers(
    id: number,
    values: string,
  ): Promise<{ added: number; refused: string[] }> {
    if (!(await this.prisma.merchGroup.count({ where: { id } }))) {
      throw new NotFoundException(GROUP_NOT_FOUND);
    }
    const { members, refused } = parseMemberValues(values);
    const { count } = await this.prisma.merchGroupMember.createMany({
      data: members.map((member) => ({ ...member, groupId: id })),
      skipDuplicates: true,
    });
    return { added: count, refused };
  }

  async removeMember(id: number, memberId: number): Promise<{ ok: true }> {
    const { count } = await this.prisma.merchGroupMember.deleteMany({
      where: { id: memberId, groupId: id },
    });
    if (!count) throw new NotFoundException('Учасника не знайдено.');
    return { ok: true };
  }

  // ---- Pickup slots ---------------------------------------------------------

  async createSlot(dto: SlotDto): Promise<{ id: number }> {
    const { date, startTime, endTime } = dto;
    const problem = slotProblem(date, startTime, endTime);
    if (problem) throw new BadRequestException(problem);
    const { id } = await this.prisma.merchPickupSlot.create({
      data: { date: slotDate(date), startTime, endTime },
      select: { id: true },
    });
    return { id };
  }

  /** A slot with orders stays for their history, so it is only switched off. */
  async deleteSlot(id: number): Promise<{ ok: true; deactivated: boolean }> {
    const orders = await this.prisma.merchOrder.count({
      where: { pickupSlotId: id },
    });
    if (orders > 0) {
      await this.prisma.merchPickupSlot.update({
        where: { id },
        data: { isActive: false },
      });
      return { ok: true, deactivated: true };
    }
    const { count } = await this.prisma.merchPickupSlot.deleteMany({
      where: { id },
    });
    if (!count) throw new NotFoundException('Слот не знайдено.');
    return { ok: true, deactivated: false };
  }
}
