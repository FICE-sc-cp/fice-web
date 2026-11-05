import { createHash, randomBytes } from 'crypto';
import {
  BadRequestException,
  GoneException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { resolveValidatedTelegramUser } from '../../auth/init-data.util';
import { MerchBotService } from '../../bot/merch-bot.service';
import { PrismaService } from '../../database/prisma.service';
import {
  CartPreview,
  LINK_TTL_MS,
  MAX_RECIPIENTS,
  ProductRow,
  ProductView,
  SESSION_TTL_MS,
  mergeLines,
  normalizePhone,
  priceCart,
  viewProduct,
} from './merch-rules';
import type { CartLineDto, RecipientDto } from './merch.dto';

export interface Viewer {
  telegramId: bigint;
  username?: string; // lowercase, no @
  firstName?: string;
  lastName?: string;
}

// Mirrors of client/web/lib/merch-types.ts.
export interface Label {
  id: number;
  name: string;
}

export interface CatalogItem {
  id: number;
  title: string;
  categoryId: number | null;
  tagIds: number[];
  thumbUrl: string | null;
  minPrice: string;
  soldOut: boolean;
}

export interface Catalog {
  products: CatalogItem[];
  categories: Label[];
  tags: Label[];
  botUsername: string | null;
}

export interface Recipient {
  id: number;
  fullName: string;
  phone: string;
  isDefault: boolean;
}

export interface LinkStart {
  token: string;
  botUrl: string;
  expiresAt: string;
}

export type LinkPoll = { linked: false } | { linked: true; session: string };

const NO_RECIPIENT = 'Отримувача не знайдено.';
const NO_SESSION = 'Сесію не знайдено';

const sha256 = (x: string) => createHash('sha256').update(x).digest('hex');

/** Viewer, catalog, product, cart preview, link flow and recipients. */
@Injectable()
export class MerchCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly bot: MerchBotService,
  ) {}

  // ---- Identity -------------------------------------------------------------

  /** Web session or init data; null for anyone else. No writes. */
  async viewer(req: Request): Promise<Viewer | null> {
    const token = req.headers['x-merch-token'];
    if (typeof token === 'string' && token) {
      const link = await this.prisma.merchLink.findUnique({
        where: { sessionHash: sha256(token) },
        include: { customer: true },
      });
      if (!link?.customer || link.expiresAt < new Date()) return null;
      const c = link.customer;
      return {
        telegramId: c.telegramId,
        username: c.username ?? undefined,
        firstName: c.firstName ?? undefined,
        lastName: c.lastName ?? undefined,
      };
    }
    const initData = req.headers['x-telegram-init-data'];
    const { tgUserId, tgTag } = req.query;
    try {
      const u = resolveValidatedTelegramUser(
        this.config,
        typeof initData === 'string' ? initData : undefined,
        {
          id: typeof tgUserId === 'string' ? tgUserId : undefined,
          tag: typeof tgTag === 'string' ? tgTag : undefined,
        },
        ['MERCH_BOT_TOKEN'],
      );
      return {
        telegramId: u.telegramId,
        username: u.username?.toLowerCase(),
        firstName: u.firstName,
        lastName: u.lastName,
      };
    } catch {
      return null;
    }
  }

  /** Same, but 401 when absent. */
  async customer(req: Request): Promise<Viewer> {
    const viewer = await this.viewer(req);
    if (!viewer) {
      throw new UnauthorizedException('Увійдіть через Telegram ще раз.');
    }
    return viewer;
  }

  /** Upsert of names only, for the POST routes that need the row. Never on a read. */
  async ensureCustomer(
    viewer: Viewer,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const { telegramId } = viewer;
    const names = {
      username: viewer.username ?? null,
      firstName: viewer.firstName ?? null,
      lastName: viewer.lastName ?? null,
    };
    await tx.merchCustomer.upsert({
      where: { telegramId },
      create: { telegramId, ...names },
      update: names,
    });
  }

  /** Group ids by telegram id or stored username; [] for null. No query for anonymous viewers. */
  async groupIds(viewer: Viewer | null): Promise<number[]> {
    if (!viewer) return [];
    // Prisma reads { username: undefined } as "no condition", which would put
    // a person without a username in every group.
    const OR = [
      { telegramId: viewer.telegramId },
      ...(viewer.username ? [{ username: viewer.username }] : []),
    ];
    const rows = await this.prisma.merchGroupMember.findMany({
      where: { OR },
      select: { groupId: true },
    });
    return [...new Set(rows.map((r) => r.groupId))];
  }

  // ---- Public reads ---------------------------------------------------------

  // ponytail: no server cache, one statement per page view, so an admin edit shows
  // on the next load. A few seconds of cache per group set if a sale makes this hot.
  /** One statement, no writes, thumbnails only. */
  async catalog(groupIds: number[]): Promise<Catalog> {
    const [row] = await this.prisma.$queryRaw<[Omit<Catalog, 'botUsername'>]>`
      WITH visible AS (
        SELECT p.id, p.title, p."categoryId", p."order",
          d.color AS "defaultColor",
          COALESCE(m."minAvailable", m."minAll")::text AS "minPrice",
          NOT m."anyAvailable" AS "soldOut",
          (SELECT ph."thumbUrl" FROM "MerchPhoto" ph WHERE ph."productId" = p.id
            ORDER BY (ph.color = d.color) DESC, (ph.color = '') DESC, ph.id LIMIT 1) AS "thumbUrl",
          ARRAY(SELECT t."tagId" FROM "MerchProductTag" t
                WHERE t."productId" = p.id ORDER BY t."tagId") AS "tagIds"
        FROM "MerchProduct" p
        CROSS JOIN LATERAL (
          SELECT v.color FROM "MerchVariant" v WHERE v."productId" = p.id
          ORDER BY (v.stock IS NULL OR v.stock > 0) DESC, v."order" % 100, v.id LIMIT 1
        ) d
        CROSS JOIN LATERAL (
          SELECT min(v.price) AS "minAll",
                 min(v.price) FILTER (WHERE v.stock IS NULL OR v.stock > 0) AS "minAvailable",
                 bool_or(v.stock IS NULL OR v.stock > 0) AS "anyAvailable"
          FROM "MerchVariant" v WHERE v."productId" = p.id
        ) m
        WHERE p."isActive"
          AND (
            NOT EXISTS (SELECT 1 FROM "MerchProductGroup" g WHERE g."productId" = p.id)
            OR EXISTS (SELECT 1 FROM "MerchProductGroup" g
                       WHERE g."productId" = p.id AND g."groupId" = ANY(${groupIds}::int[]))
          )
      )
      SELECT
        COALESCE((SELECT json_agg(json_build_object(
            'id', v.id, 'title', v.title, 'categoryId', v."categoryId", 'tagIds', v."tagIds",
            'thumbUrl', v."thumbUrl", 'minPrice', v."minPrice", 'soldOut', v."soldOut")
          ORDER BY v."order", v.id DESC) FROM visible v), '[]') AS products,
        COALESCE((SELECT json_agg(json_build_object('id', c.id, 'name', c.name) ORDER BY c."order", c.id)
                  FROM "MerchCategory" c
                  WHERE c.id IN (SELECT "categoryId" FROM visible)), '[]') AS categories,
        COALESCE((SELECT json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t."order", t.id)
                  FROM "MerchTag" t
                  WHERE t.id IN (SELECT pt."tagId" FROM "MerchProductTag" pt
                                 JOIN visible v ON v.id = pt."productId")), '[]') AS tags`;
    return { ...row, botUsername: this.bot.getUsername() ?? null };
  }

  async product(id: number, groupIds: number[]): Promise<ProductView> {
    const [row] = await this.prisma.$queryRaw<ProductRow[]>`
      SELECT p.id, p.title, p.description, p."isActive", p."categoryId",
        COALESCE((SELECT json_agg(json_build_object('id', v.id, 'size', v.size, 'color', v.color,
            'price', v.price::text, 'stock', v.stock, 'order', v."order") ORDER BY v."order", v.id)
          FROM "MerchVariant" v WHERE v."productId" = p.id), '[]') AS variants,
        COALESCE((SELECT json_agg(json_build_object('color', f.color, 'url', f.url, 'thumbUrl', f."thumbUrl") ORDER BY f.id)
          FROM "MerchPhoto" f WHERE f."productId" = p.id), '[]') AS photos,
        ARRAY(SELECT t."tagId" FROM "MerchProductTag" t WHERE t."productId" = p.id) AS "tagIds",
        ARRAY(SELECT g."groupId" FROM "MerchProductGroup" g WHERE g."productId" = p.id) AS "groupIds"
      FROM "MerchProduct" p WHERE p.id = ${id}`;
    const view =
      row && viewProduct(row, groupIds, this.bot.getUsername() ?? null);
    // Same body for missing and restricted, so outsiders learn nothing.
    if (!view) throw new NotFoundException('Товар не знайдено.');
    return view;
  }

  /** Live prices only. Writes nothing; a restricted line reads exactly like a missing one. */
  async preview(
    lines: CartLineDto[],
    groupIds: number[],
  ): Promise<CartPreview> {
    const merged = mergeLines(lines);
    const variants = await this.prisma.merchVariant.findMany({
      where: { id: { in: merged.map((l) => l.variantId) } },
      include: { product: { include: { photos: true, groups: true } } },
    });
    const priced = variants.map((v) => {
      const { photos, groups, title, isActive } = v.product;
      const photo =
        photos.find((p) => p.color === v.color) ??
        photos.find((p) => p.color === '') ??
        photos[0];
      return {
        id: v.id,
        productId: v.productId,
        title,
        isActive,
        groupIds: groups.map((g) => g.groupId),
        size: v.size,
        color: v.color,
        price: v.price.toFixed(2),
        stock: v.stock,
        thumbUrl: photo?.thumbUrl ?? null,
      };
    });
    return priceCart(merged, priced, groupIds);
  }

  // ---- Link flow ------------------------------------------------------------

  async startLink(): Promise<LinkStart> {
    const username = this.bot.getUsername();
    if (!username) {
      throw new ServiceUnavailableException(
        'Оформлення через сайт тимчасово недоступне: бот не налаштований.',
      );
    }
    // Also old sessions, so no sweep timer.
    await this.prisma.merchLink.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    const token = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + LINK_TTL_MS);
    await this.prisma.merchLink.create({
      data: { linkToken: token, expiresAt },
    });
    return {
      token,
      botUrl: `https://t.me/${username}?start=link_${token}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /** The session is issued once. A lost response costs one more link, nothing else. */
  async pollLink(token: string): Promise<LinkPoll> {
    if (!/^[0-9a-f]{32}$/.test(token)) throw new NotFoundException(NO_SESSION);
    const row = await this.prisma.merchLink.findUnique({
      where: { linkToken: token },
    });
    if (!row) throw new NotFoundException(NO_SESSION);
    if (row.expiresAt < new Date()) {
      throw new GoneException('Посилання застаріло');
    }
    if (!row.telegramId) return { linked: false };
    const session = randomBytes(24).toString('base64url');
    const { count } = await this.prisma.merchLink.updateMany({
      where: { id: row.id, sessionHash: null },
      data: {
        sessionHash: sha256(session),
        linkToken: null,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
    if (!count) throw new NotFoundException(NO_SESSION);
    return { linked: true, session };
  }

  async endLink(session?: string): Promise<{ ok: true }> {
    if (session) {
      await this.prisma.merchLink.deleteMany({
        where: { sessionHash: sha256(session) },
      });
    }
    return { ok: true };
  }

  // ---- Recipients -----------------------------------------------------------

  recipients(viewer: Viewer): Promise<Recipient[]> {
    return this.prisma.merchRecipient.findMany({
      where: { telegramId: viewer.telegramId },
      orderBy: { id: 'asc' },
      select: { id: true, fullName: true, phone: true, isDefault: true },
    });
  }

  /**
   * Re-adding is not an error, and a customer's first recipient becomes the default.
   * Run it after ensureCustomer in the same transaction: Prisma does this upsert in
   * two statements, and the customer row lock is what keeps a double tap off it and
   * the cap honest. null is a new recipient over MAX_RECIPIENTS: nothing is saved.
   */
  async saveRecipient(
    tx: Prisma.TransactionClient,
    telegramId: bigint,
    fullName: string,
    phone: string,
  ): Promise<{ id: number } | null> {
    const where = {
      telegramId_fullName_phone: { telegramId, fullName, phone },
    };
    const owned = await tx.merchRecipient.count({ where: { telegramId } });
    if (owned >= MAX_RECIPIENTS) {
      return tx.merchRecipient.findUnique({ where, select: { id: true } });
    }
    return tx.merchRecipient.upsert({
      where,
      create: { telegramId, fullName, phone, isDefault: owned === 0 },
      update: {},
      select: { id: true },
    });
  }

  async addRecipient(
    viewer: Viewer,
    dto: RecipientDto,
  ): Promise<{ id: number }> {
    const fullName = dto.fullName.trim();
    if (!fullName) throw new BadRequestException('Заповніть дані отримувача.');
    const phone = normalizePhone(dto.phone);
    if (!phone) {
      throw new BadRequestException('Вкажіть коректний номер телефону.');
    }
    return this.prisma.$transaction(async (tx) => {
      await this.ensureCustomer(viewer, tx);
      const saved = await this.saveRecipient(
        tx,
        viewer.telegramId,
        fullName,
        phone,
      );
      if (!saved) {
        throw new BadRequestException(
          'Забагато збережених отримувачів. Видаліть когось зі списку.',
        );
      }
      return saved;
    });
  }

  async deleteRecipient(viewer: Viewer, id: number): Promise<{ ok: true }> {
    const { telegramId } = viewer;
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.merchRecipient.findFirst({
        where: { id, telegramId },
      });
      if (!row) throw new NotFoundException(NO_RECIPIENT);
      await tx.merchRecipient.deleteMany({ where: { id, telegramId } });
      if (!row.isDefault) return;
      const oldest = await tx.merchRecipient.findFirst({
        where: { telegramId },
        orderBy: { id: 'asc' },
      });
      if (oldest) {
        await tx.merchRecipient.updateMany({
          where: { id: oldest.id, telegramId },
          data: { isDefault: true },
        });
      }
    });
    return { ok: true };
  }

  async defaultRecipient(viewer: Viewer, id: number): Promise<{ ok: true }> {
    const { telegramId } = viewer;
    await this.prisma.$transaction(async (tx) => {
      await tx.merchRecipient.updateMany({
        where: { telegramId },
        data: { isDefault: false },
      });
      const { count } = await tx.merchRecipient.updateMany({
        where: { id, telegramId },
        data: { isDefault: true },
      });
      // Thrown inside the transaction, so the old default comes back.
      if (!count) throw new NotFoundException(NO_RECIPIENT);
    });
    return { ok: true };
  }
}
