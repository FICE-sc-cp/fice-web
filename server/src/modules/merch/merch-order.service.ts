import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { MerchDeliveryMethod, MerchOrderStatus } from '@prisma/client';
import { MerchBotService } from '../../bot/merch-bot.service';
import { PrismaService } from '../../database/prisma.service';
import { OWN_IMAGE_URL, ownUploadExists } from '../../upload/own-upload';
import {
  MerchCatalogService,
  Recipient,
  Viewer,
} from './merch-catalog.service';
import {
  CartPreview,
  MAX_PENDING_ORDERS,
  VariantNow,
  addressFor,
  canChoosePickup,
  decideOrder,
  fromKopecks,
  kyivNow,
  mergeLines,
  normalizePhone,
  optionsLabel,
  pickupProblem,
  slotDate,
  slotDay,
  slotLabel,
  slotVisible,
  toKopecks,
} from './merch-rules';
import type { CartLineDto, CreateOrderDto, PickupDto } from './merch.dto';

// Mirrors of client/web/lib/merch-types.ts.
export interface ShopInfo {
  monoJarUrl: string;
  cardNumber: string | null;
  dayfEnabled: boolean;
  currency: string;
}

export interface CheckoutStart {
  cart: CartPreview;
  recipients: Recipient[];
  shop: ShopInfo;
}

export interface CreatedOrder {
  id: number;
  total: string;
  repeated: boolean;
}

export interface OrderRow {
  id: number;
  status: MerchOrderStatus;
  totalAmount: string;
  createdAt: string;
  deliveryMethod: MerchDeliveryMethod | null;
  address: string;
  items: {
    title: string;
    options: string;
    quantity: number;
    unitPrice: string;
  }[];
  pickupLabel: string | null;
  needsIndividualPickup: boolean;
  canChoosePickup: boolean;
}

export interface PickupSlotView {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  label: string;
}

export interface PickupInfo {
  id: number;
  status: MerchOrderStatus;
  canChoose: boolean;
  slots: PickupSlotView[];
}

const RATE_WINDOW_MS = 60_000;
const ORDERS_PER_WINDOW = 5;
const ORDERS_SHOWN = 100;
// Under a rush buyers of one variant queue on its row lock.
const ORDER_TX = { maxWait: 10_000, timeout: 15_000 };

const tooMany = (text: string) =>
  new HttpException(text, HttpStatus.TOO_MANY_REQUESTS);

type StoredOrder = Prisma.MerchOrderGetPayload<{
  include: { items: true; pickupSlot: true };
}>;

function orderRow(order: StoredOrder): OrderRow {
  const { pickupSlot } = order;
  return {
    id: order.id,
    status: order.status,
    totalAmount: order.totalAmount.toFixed(2),
    createdAt: order.createdAt.toISOString(),
    deliveryMethod: order.deliveryMethod,
    address: order.address,
    items: order.items.map((item) => ({
      title: item.title,
      options: optionsLabel(item.size, item.color),
      quantity: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
    })),
    pickupLabel: pickupSlot
      ? slotLabel({ ...pickupSlot, date: slotDay(pickupSlot.date) })
      : null,
    needsIndividualPickup: order.needsIndividualPickup,
    canChoosePickup: canChoosePickup(order),
  };
}

/** Checkout start, create order, order list and pickup. */
@Injectable()
export class MerchOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: MerchCatalogService,
    private readonly bot: MerchBotService,
  ) {}

  // ---- Checkout -------------------------------------------------------------

  /** The only place that serves payment details, so an unlinked visitor never gets them. */
  async startCheckout(
    viewer: Viewer,
    lines: CartLineDto[],
    groupIds: number[],
  ): Promise<CheckoutStart> {
    await this.assertPendingCap(viewer.telegramId);
    const [cart, recipients, shop] = await Promise.all([
      this.catalog.preview(lines, groupIds),
      this.catalog.recipients(viewer),
      this.bot.shopConfig(),
    ]);
    const { monoJarUrl, cardNumber, dayfEnabled, currency } = shop;
    return {
      cart,
      recipients,
      shop: { monoJarUrl, cardNumber, dayfEnabled, currency },
    };
  }

  /**
   * The customer has already paid, so nothing about stock, price or archive
   * refuses here: decideOrder turns all of that into warnings for the admin who
   * checks the receipt. Everything a user can fix is validated before any write.
   */
  async createOrder(
    viewer: Viewer,
    dto: CreateOrderDto,
    viewerGroups: number[],
  ): Promise<CreatedOrder> {
    const { telegramId } = viewer;
    const repeat = await this.repeatOf(telegramId, dto.clientKey);
    if (repeat) return repeat;

    await this.assertRate(telegramId);
    await this.assertPendingCap(telegramId);

    const recipient = await this.recipientOf(telegramId, dto);
    if (dto.delivery === 'NOVA_POSHTA' && !dto.address?.trim()) {
      throw new BadRequestException('Вкажіть адресу для Нової Пошти.');
    }
    if (!ownUploadExists(dto.receiptUrl, OWN_IMAGE_URL)) {
      throw new BadRequestException(
        'Квитанцію не знайдено. Завантажте її ще раз.',
      );
    }
    // Before the transaction: a second connection from inside one can starve the pool.
    const shop = await this.bot.shopConfig();

    let order: { id: number; totalAmount: Prisma.Decimal };
    try {
      order = await this.prisma.$transaction(async (tx) => {
        await this.catalog.ensureCustomer(viewer, tx);
        const ids = dto.lines.map((l) => l.variantId);
        // Locked in id order, so two orders can never deadlock.
        const variants = await tx.$queryRaw<VariantNow[]>`
          SELECT v.id, v."productId", v.stock, v.price::text AS price, v.size, v.color, p.title, p."isActive",
                 ARRAY(SELECT g."groupId" FROM "MerchProductGroup" g WHERE g."productId" = p.id) AS "groupIds"
          FROM "MerchVariant" v JOIN "MerchProduct" p ON p.id = v."productId"
          WHERE v.id = ANY(${ids}::int[]) ORDER BY v.id FOR UPDATE OF v`;
        const decision = decideOrder(
          mergeLines(dto.lines),
          new Map(variants.map((v) => [v.id, v])),
          viewerGroups,
          toKopecks(dto.expectedTotal),
        );
        if (dto.delivery === 'DAYF' && !shop.dayfEnabled) {
          decision.warnings.push(
            '⚠️ DayF вимкнено, клієнт обрав його до вимкнення',
          );
        }
        for (const { id, left } of decision.stock) {
          await tx.merchVariant.update({
            where: { id },
            data: { stock: left },
          });
        }
        if (recipient.typed && dto.saveRecipient) {
          await this.catalog.saveRecipient(
            tx,
            telegramId,
            recipient.fullName,
            recipient.phone,
          );
        }
        return tx.merchOrder.create({
          data: {
            telegramId,
            deliveryMethod: dto.delivery,
            address: addressFor(dto.delivery, dto.address),
            phone: recipient.phone,
            recipientName: recipient.fullName,
            totalAmount: fromKopecks(decision.totalKopecks),
            currency: shop.currency,
            receiptUrl: dto.receiptUrl,
            clientKey: dto.clientKey,
            warnings: decision.warnings,
            cardDirty: true,
            notifyDirty: true,
            items: {
              create: decision.items.map((item) => ({
                productId: item.productId,
                variantId: item.variantId,
                title: item.title,
                size: item.size,
                color: item.color,
                unitPrice: fromKopecks(item.unitKopecks),
                quantity: item.quantity,
                stockTaken: item.stockTaken,
              })),
            },
          },
          select: { id: true, totalAmount: true },
        });
      }, ORDER_TX);
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError)) throw err;
      // The global filter would answer 400 and stop the submit loop. A 503 makes
      // it retry with the same key, and validation already ran, so no user error
      // lands here.
      if (err.code !== 'P2002') {
        throw new ServiceUnavailableException('Спробуйте ще раз за хвилину.');
      }
      // A concurrent duplicate. Its whole transaction rolled back, stock included.
      // meta.target differs under the pg adapter, so the re-read is the real test.
      const winner = await this.repeatOf(telegramId, dto.clientKey);
      if (winner) return winner;
      throw err;
    }
    this.bot.kick();
    return {
      id: order.id,
      total: order.totalAmount.toFixed(2),
      repeated: false,
    };
  }

  private async repeatOf(
    telegramId: bigint,
    clientKey: string,
  ): Promise<CreatedOrder | null> {
    const order = await this.prisma.merchOrder.findUnique({
      where: { telegramId_clientKey: { telegramId, clientKey } },
      select: { id: true, totalAmount: true },
    });
    return (
      order && {
        id: order.id,
        total: order.totalAmount.toFixed(2),
        repeated: true,
      }
    );
  }

  // ponytail: both limits count outside the transaction, so simultaneous submits
  // with new keys can pass one by a few. Each needs its own receipt upload, so that
  // stays small; count under the customer row lock if it ever matters.
  private async assertRate(telegramId: bigint): Promise<void> {
    const recent = await this.prisma.merchOrder.count({
      where: {
        telegramId,
        createdAt: { gt: new Date(Date.now() - RATE_WINDOW_MS) },
      },
    });
    if (recent >= ORDERS_PER_WINDOW) {
      throw tooMany('Забагато спроб. Зачекайте хвилину.');
    }
  }

  private async assertPendingCap(telegramId: bigint): Promise<void> {
    const pending = await this.prisma.merchOrder.count({
      where: { telegramId, status: 'PENDING' },
    });
    if (pending >= MAX_PENDING_ORDERS) {
      throw tooMany(
        'Забагато необроблених замовлень. Зачекайте на перевірку адміністратора.',
      );
    }
  }

  /** A saved recipient, or the one typed in the form (`typed`). */
  private async recipientOf(telegramId: bigint, dto: CreateOrderDto) {
    if (dto.recipientId != null) {
      const saved = await this.prisma.merchRecipient.findFirst({
        where: { id: dto.recipientId, telegramId },
      });
      if (!saved) throw new NotFoundException('Отримувача не знайдено.');
      return { fullName: saved.fullName, phone: saved.phone, typed: false };
    }
    const fullName = dto.recipientName?.trim();
    const typedPhone = dto.recipientPhone?.trim();
    if (!fullName || !typedPhone) {
      throw new BadRequestException('Заповніть дані отримувача.');
    }
    const phone = normalizePhone(typedPhone);
    if (!phone) {
      throw new BadRequestException('Вкажіть коректний номер телефону.');
    }
    return { fullName, phone, typed: true };
  }

  // ---- Profile --------------------------------------------------------------

  async listOrders(viewer: Viewer): Promise<OrderRow[]> {
    // ponytail: the newest 100, no paging. Nobody is near that yet.
    const orders = await this.prisma.merchOrder.findMany({
      where: { telegramId: viewer.telegramId },
      orderBy: { createdAt: 'desc' },
      take: ORDERS_SHOWN,
      include: { items: { orderBy: { id: 'asc' } }, pickupSlot: true },
    });
    return orders.map(orderRow);
  }

  // ---- Pickup ---------------------------------------------------------------

  async pickupInfo(viewer: Viewer, id: number): Promise<PickupInfo> {
    const order = await this.ownOrder(viewer, id);
    const canChoose = canChoosePickup(order);
    return {
      id: order.id,
      status: order.status,
      canChoose,
      slots: canChoose ? await this.openSlots() : [],
    };
  }

  /** Telegram is never called here: pickupDirty and kick() hand the messages to the sync loop. */
  async choosePickup(
    viewer: Viewer,
    id: number,
    dto: PickupDto,
  ): Promise<{ ok: true }> {
    const order = await this.ownOrder(viewer, id);
    const problem = pickupProblem(order);
    if (problem === 'delivery') {
      throw new BadRequestException(
        'Для цього способу доставки час видачі не обирається.',
      );
    }
    if (problem === 'status') {
      throw new ConflictException(
        'Час можна обрати, коли замовлення готове до видачі.',
      );
    }
    const { needsIndividualPickup } = dto;
    const pickupSlotId = dto.pickupSlotId ?? null;
    if (pickupSlotId === null && !needsIndividualPickup) {
      throw new BadRequestException('Оберіть час або індивідуальну видачу.');
    }
    if (
      pickupSlotId !== null &&
      !(await this.openSlots()).some((slot) => slot.id === pickupSlotId)
    ) {
      throw new BadRequestException('Цей час уже недоступний. Оберіть інший.');
    }
    // The write is the claim, so no explicit lock is needed.
    const { count } = await this.prisma.merchOrder.updateMany({
      where: {
        id,
        telegramId: viewer.telegramId,
        status: 'READY_FOR_PICKUP',
        pickupSlotId: null,
        needsIndividualPickup: false,
      },
      data: { pickupSlotId, needsIndividualPickup, pickupDirty: true },
    });
    if (count) {
      this.bot.kick();
      return { ok: true };
    }
    const chosen = await this.ownOrder(viewer, id);
    if (
      chosen.pickupSlotId === pickupSlotId &&
      chosen.needsIndividualPickup === needsIndividualPickup
    ) {
      return { ok: true }; // a double tap stays silent
    }
    throw new ConflictException(
      'Час уже обрано. Напишіть у підтримку, щоб змінити.',
    );
  }

  private async ownOrder(viewer: Viewer, id: number) {
    const order = await this.prisma.merchOrder.findFirst({
      where: { id, telegramId: viewer.telegramId },
      select: {
        id: true,
        status: true,
        deliveryMethod: true,
        pickupSlotId: true,
        needsIndividualPickup: true,
      },
    });
    if (!order) throw new NotFoundException('Замовлення не знайдено.');
    return order;
  }

  /** Active slots a customer may take right now, soonest first. */
  private async openSlots(): Promise<PickupSlotView[]> {
    const now = kyivNow(new Date());
    const rows = await this.prisma.merchPickupSlot.findMany({
      where: { isActive: true, date: { gte: slotDate(now.date) } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
    const used = await this.prisma.merchOrder.findMany({
      where: {
        pickupSlotId: { in: rows.map((r) => r.id) },
        status: { not: 'CANCELLED' },
      },
      select: { pickupSlotId: true },
      distinct: ['pickupSlotId'],
    });
    const booked = new Set(used.map((o) => o.pickupSlotId as number));
    return rows
      .map((r) => ({ ...r, date: slotDay(r.date) }))
      .filter((slot) => slotVisible(slot, now, booked))
      .map(({ id, date, startTime, endTime }) => ({
        id,
        date,
        startTime,
        endTime,
        label: slotLabel({ date, startTime, endTime }),
      }));
  }
}
