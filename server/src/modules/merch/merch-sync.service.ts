import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MerchConfig, MerchOrderStatus, Prisma } from '@prisma/client';
import { existsSync } from 'fs';
import { InputFile } from 'grammy';
import type { InlineKeyboardMarkup } from 'grammy/types';
import { basename, resolve } from 'path';
import { MerchBotService } from '../../bot/merch-bot.service';
import { errorMessage } from '../../common/log-safe';
import { PrismaService } from '../../database/prisma.service';
import { UPLOAD_DIR } from '../../upload/upload.constants';
import {
  CAPTION_LIMIT,
  inThread,
  OPEN_STATUSES,
  slotChatLabel,
  slotDay,
  sourcesOf,
  telegramFailure,
  TEXT_LIMIT,
} from './merch-rules';
import {
  orderCardText,
  pickupNotices,
  receivedNotice,
  statusChanged,
  statusKeyboard,
  statusNotice,
  statusStale,
  TEXT,
} from './merch-texts';

const TICK_MS = 15_000;
const BATCH = 20;
const CARD_INCLUDE = { items: true, customer: true } as const;

type CardRow = Prisma.MerchOrderGetPayload<{ include: typeof CARD_INCLUDE }>;

/** What became of a message to a customer; 'keep' leaves the flag for the next pass. */
type Delivery = 'sent' | 'blocked' | 'dropped' | 'keep';

/**
 * Level-triggered delivery: the three flags on an order say what Telegram still
 * owes, so a restart loses nothing and imported orders, all flags false, are
 * never re-sent. Handlers and routes only flip flags and kick; nothing here runs
 * inside a request or a click.
 */
@Injectable()
export class MerchSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MerchSyncService.name);
  private timer?: NodeJS.Timeout;
  private draining = false;
  private again = false;
  private pausedUntil = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: MerchBotService,
    private readonly config: ConfigService,
  ) {}

  private get api() {
    return this.bot.telegram!.api;
  }

  onModuleInit() {
    if (!this.bot.enabled) return;
    this.bot.setKick(() => void this.drain());
    this.timer = setInterval(() => void this.drain(), TICK_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  // ponytail: one process assumed; FOR UPDATE SKIP LOCKED if there is ever a
  // second instance. Delivery is at least once: a crash between Telegram's reply
  // and the DB write can repeat a card or a message once, which the state
  // machine tolerates.
  async drain(): Promise<void> {
    // The boot guard refused the token, so nothing may reach that bot's chats. The
    // bot kicks once polling is up.
    if (this.bot.pollingStatus() === 'disabled') return;
    if (this.draining) {
      this.again = true;
      return;
    }
    if (Date.now() < this.pausedUntil) return;
    this.draining = true;
    try {
      const shop = await this.bot.shopConfig();
      // No bound chat: flags wait, cards go after /bind_admin_chat.
      if (shop.adminChatId) {
        await this.drainCards();
        await this.drainPickups();
      }
      await this.drainNotices();
    } catch (err) {
      const failure = telegramFailure(err);
      if (failure.kind === 'rate') {
        this.pausedUntil = Date.now() + failure.seconds * 1000;
      } else {
        this.logger.warn('Merch sync failed: ' + errorMessage(err));
      }
    } finally {
      this.draining = false;
      if (this.again) {
        this.again = false;
        setImmediate(() => void this.drain());
      }
    }
  }

  /**
   * After every change of adminChatId. Old cards keep buttons that the bound chat
   * check refuses and message ids that mean nothing in the new chat, so each open
   * order gets a fresh card there.
   */
  async resendOpenCards(): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.merchOrder.updateMany({
        where: { adminMessageId: { not: null } },
        data: { adminMessageId: null },
      }),
      this.prisma.merchOrder.updateMany({
        where: { status: { in: OPEN_STATUSES } },
        data: { cardDirty: true },
      }),
    ]);
  }

  /** Every write of blockedBot: the card prints it, so a change re-edits the open ones. */
  async setBlocked(telegramId: bigint, blockedBot: boolean): Promise<void> {
    const { count } = await this.prisma.merchCustomer.updateMany({
      where: { telegramId, blockedBot: !blockedBot },
      data: { blockedBot },
    });
    if (!count) return;
    await this.prisma.merchOrder.updateMany({
      where: { telegramId, status: { in: OPEN_STATUSES } },
      data: { cardDirty: true },
    });
    this.bot.kick();
  }

  /** The status button. One local write, all Telegram work follows from the row. */
  async changeStatus(
    id: number,
    to: MerchOrderStatus,
    actor: string,
  ): Promise<{ text: string; show_alert?: boolean }> {
    const changed = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.merchOrder.updateMany({
        where: { id, status: { in: sourcesOf(to) } },
        data: {
          status: to,
          statusBy: actor,
          cardDirty: true,
          notifyDirty: true,
          ...(to === 'IN_PROCESS' ? { processedByAdmin: actor } : {}),
        },
      });
      if (!count) return false;
      if (to === 'CANCELLED') {
        const items = await tx.merchOrderItem.findMany({
          where: {
            orderId: id,
            stockTaken: { gt: 0 },
            variantId: { not: null },
          },
          orderBy: { variantId: 'asc' }, // same order as checkout, so the two cannot deadlock
        });
        for (const item of items) {
          await tx.$executeRaw`UPDATE "MerchVariant" SET stock = stock + ${item.stockTaken}
                               WHERE id = ${item.variantId} AND stock IS NOT NULL`;
        }
      }
      return true;
    });
    if (changed) return { text: statusChanged(to) };
    const order = await this.prisma.merchOrder.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!order) return { text: TEXT.orderMissing, show_alert: true };
    // A stale button repairs its own card.
    await this.prisma.merchOrder.update({
      where: { id },
      data: { cardDirty: true },
    });
    return {
      text: order.status === to ? TEXT.sameStatus : statusStale(order.status),
    };
  }

  private async drainCards() {
    // ponytail: seq scan is fine until tens of thousands of orders; add a partial index then.
    const orders = await this.prisma.merchOrder.findMany({
      where: { cardDirty: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      include: CARD_INCLUDE,
    });
    let cleared = 0;
    for (const order of orders) {
      // Inside the loop: a `migrated` answer rewrites the chat mid batch.
      const shop = await this.bot.shopConfig();
      let sentId: number | undefined;
      try {
        if (order.adminMessageId === null) {
          sentId = await this.sendCard(order, shop);
        } else {
          await this.editCard(order, order.adminMessageId, shop);
        }
      } catch (err) {
        await this.chatFailed(err, order.id);
        // The rest of this batch still holds message ids of the old chat.
        if (telegramFailure(err).kind === 'migrated') return;
        continue;
      }
      if (sentId) {
        await this.prisma.merchOrder.update({
          where: { id: order.id },
          data: { adminMessageId: sentId }, // always kept
        });
      }
      // On what it read: a status change or a chat move during the send stays dirty.
      const { count } = await this.prisma.merchOrder.updateMany({
        where: {
          id: order.id,
          status: order.status,
          adminMessageId: sentId ?? order.adminMessageId,
        },
        data: { cardDirty: false },
      });
      cleared += count;
    }
    // A batch that fails whole waits for the timer instead of spinning.
    if (orders.length === BATCH && cleared) this.again = true;
  }

  private sendCard(order: CardRow, shop: MerchConfig): Promise<number> {
    const chat = Number(shop.adminChatId);
    return inThread(
      shop.ordersThreadId,
      async (thread) => {
        const { messageId, overflow } = await this.postCard(
          order,
          chat,
          thread,
        );
        if (overflow) {
          await this.api
            .sendMessage(chat, overflow.slice(0, TEXT_LIMIT), {
              reply_parameters: {
                message_id: messageId,
                allow_sending_without_reply: true,
              },
              message_thread_id: thread,
            })
            .catch((err) => {
              this.logger.warn(
                `Merch card #${order.id} overflow failed: ${errorMessage(err)}`,
              );
            });
        }
        return messageId;
      },
      this.logger,
    );
  }

  private async postCard(order: CardRow, chat: number, thread?: number) {
    const reply_markup = statusKeyboard(order.id, order.status);
    const file = this.receiptFile(order);
    if (file) {
      const caption = orderCardText(order, CAPTION_LIMIT);
      try {
        const sent = await this.api.sendPhoto(chat, file, {
          caption: caption.text,
          reply_markup,
          message_thread_id: thread,
        });
        return { messageId: sent.message_id, overflow: caption.overflow };
      } catch (err) {
        const { kind } = telegramFailure(err);
        if (kind !== 'media' && kind !== 'gone') throw err;
        this.logger.warn(
          `Merch receipt #${order.id} not attached: ${errorMessage(err)}`,
        );
      }
    }
    const card = this.textCard(order);
    const sent = await this.api.sendMessage(chat, card.text, {
      reply_markup,
      message_thread_id: thread,
    });
    return { messageId: sent.message_id, overflow: card.overflow };
  }

  private receiptFile(order: CardRow): InputFile | string | undefined {
    if (order.receiptUrl) {
      const path = resolve(UPLOAD_DIR, basename(order.receiptUrl));
      if (existsSync(path)) return new InputFile(path);
    }
    return order.receiptFileId ?? undefined;
  }

  /** The card when no photo carries it. Sending and editing both use it, so the link stays. */
  private textCard(order: CardRow) {
    const site = this.config
      .get<string>('PUBLIC_WEB_URL')
      ?.trim()
      .replace(/\/+$/, '');
    const link = order.receiptUrl ? `\n${site ?? ''}${order.receiptUrl}` : '';
    const tail = `\n\n${TEXT.receiptMissing}${link}`;
    const card = orderCardText(order, TEXT_LIMIT - tail.length);
    return { text: card.text + tail, overflow: card.overflow };
  }

  private editCard(order: CardRow, messageId: number, shop: MerchConfig) {
    const chat = Number(shop.adminChatId);
    const reply_markup = statusKeyboard(order.id, order.status);
    const { text: caption } = orderCardText(order, CAPTION_LIMIT);
    return this.api
      .editMessageCaption(chat, messageId, { caption, reply_markup })
      .catch((err: unknown) => {
        if (telegramFailure(err).kind !== 'wrongEdit') throw err;
        return this.api.editMessageText(
          chat,
          messageId,
          this.textCard(order).text,
          { reply_markup },
        );
      })
      .catch((err: unknown) => {
        const { kind } = telegramFailure(err);
        if (kind !== 'unchanged' && kind !== 'gone') throw err;
      });
  }

  /** The admin chat refused. A 429 ends the pass; in every other case the flag stays. */
  private async chatFailed(err: unknown, orderId: number) {
    const failure = telegramFailure(err);
    if (failure.kind === 'rate') throw err;
    if (failure.kind === 'migrated') {
      await this.bot.updateShopConfig({ adminChatId: BigInt(failure.chatId) });
      await this.resendOpenCards();
      this.bot.clearAdminCache();
      this.again = true;
      return;
    }
    this.logger.warn(`Merch order #${orderId} failed: ${errorMessage(err)}`);
  }

  private async drainPickups() {
    const orders = await this.prisma.merchOrder.findMany({
      where: { pickupDirty: true },
      take: BATCH,
      include: { pickupSlot: true },
    });
    for (const order of orders) {
      const { pickupSlot, adminMessageId } = order;
      const slot = pickupSlot
        ? slotChatLabel({ ...pickupSlot, date: slotDay(pickupSlot.date) })
        : null;
      const { admin, customer } = pickupNotices(order, slot);
      const shop = await this.bot.shopConfig();
      try {
        await inThread(
          shop.ordersThreadId,
          (thread) =>
            this.api.sendMessage(Number(shop.adminChatId), admin, {
              message_thread_id: thread,
              ...(adminMessageId
                ? {
                    reply_parameters: {
                      message_id: adminMessageId,
                      allow_sending_without_reply: true,
                    },
                  }
                : {}),
            }),
          this.logger,
        );
      } catch (err) {
        await this.chatFailed(err, order.id);
        // A 400 ends here as it does for a notice: the customer still hears back.
        if (telegramFailure(err).kind !== 'gone') continue;
      }
      const delivery = customer
        ? await this.messageCustomer(order.telegramId, customer)
        : 'sent';
      if (delivery === 'keep') continue;
      // No CAS: a choice is final.
      // ponytail: a retry after a half-done pass can repeat the admin note.
      await this.prisma.merchOrder.update({
        where: { id: order.id },
        data: {
          pickupDirty: false,
          ...(delivery === 'blocked' ? { cardDirty: true } : {}),
        },
      });
    }
  }

  private async drainNotices() {
    const orders = await this.prisma.merchOrder.findMany({
      where: { notifyDirty: true },
      orderBy: { id: 'asc' },
      take: BATCH,
    });
    for (const order of orders) {
      // statusNotice is null only for PENDING.
      const notice = statusNotice(order) ?? {
        text: receivedNotice(order.id),
        pickupButton: false,
      };
      const url = notice.pickupButton
        ? this.bot.appUrl(
            `/pickup/${order.id}?_t=${Math.floor(Date.now() / 1000)}`,
          )
        : undefined;
      const delivery = await this.messageCustomer(
        order.telegramId,
        notice.text,
        url
          ? {
              reply_markup: {
                inline_keyboard: [
                  [{ text: TEXT.pickupButton, web_app: { url } }],
                ],
              },
            }
          : undefined,
      );
      if (delivery === 'keep') continue;
      if (delivery === 'sent') {
        // On the status it read, so two quick clicks send only the latest one.
        await this.prisma.merchOrder.updateMany({
          where: { id: order.id, status: order.status },
          data: { notifyDirty: false },
        });
        continue;
      }
      await this.prisma.merchOrder.update({
        where: { id: order.id },
        data: {
          notifyDirty: false,
          ...(delivery === 'blocked' ? { cardDirty: true } : {}),
        },
      });
    }
  }

  /** A message clears its flag unless Telegram was unreachable: only a 400 or a 403 gives up. */
  private async messageCustomer(
    telegramId: bigint,
    text: string,
    other?: { reply_markup: InlineKeyboardMarkup },
  ): Promise<Delivery> {
    try {
      await this.api.sendMessage(Number(telegramId), text, other);
      return 'sent';
    } catch (err) {
      const { kind } = telegramFailure(err);
      if (kind === 'rate') throw err;
      this.logger.warn(
        `Merch message to ${telegramId} failed: ${errorMessage(err)}`,
      );
      if (kind === 'retry') return 'keep';
      if (kind !== 'blocked') return 'dropped';
      await this.setBlocked(telegramId, true);
      return 'blocked';
    }
  }
}
