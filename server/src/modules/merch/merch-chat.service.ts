import {
  HttpException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import type { Context, Filter } from 'grammy';
import type { User } from 'grammy/types';
import { MerchBotService } from '../../bot/merch-bot.service';
import { TaskQueue } from '../../bot/task-queue';
import { errorMessage } from '../../common/log-safe';
import { PrismaService } from '../../database/prisma.service';
import {
  ADMIN_PROMPT_MS,
  CAPTION_LIMIT,
  CONFIRM_TTL_S,
  inThread,
  isFreshConfirm,
  parseOwnerIds,
  parseStart,
  parseStatusCallback,
  parseThreads,
  SUPPORT_PROMPT_MS,
  supportTarget,
  telegramFailure,
  TEXT_LIMIT,
} from './merch-rules';
import { MerchSyncService } from './merch-sync.service';
import {
  adminKeyboard,
  broadcastAsk,
  broadcastFinished,
  broadcastStarted,
  broadcastStopped,
  clearAsk,
  supportHeader,
  TEXT,
  threadsDone,
} from './merch-texts';

type ButtonContext = Filter<Context, 'callback_query:data'>;
type AnswerOptions = Exclude<
  Parameters<Context['answerCallbackQuery']>[0],
  string
>;

const CAPTIONED = [
  'photo',
  'video',
  'document',
  'audio',
  'voice',
  'animation',
] as const;
const BROADCAST_GAP_MS = 60;
const BROADCAST_TRIES = 4;
const SHUTDOWN_WAIT_MS = 8_000; // compose gives 10 s before SIGKILL
const TOKEN = /^[0-9a-f]{32}$/;

const ADMIN_PROMPTS = new Map([
  ['set_mono', { prompt: 'mono', text: TEXT.monoPrompt }],
  ['set_card', { prompt: 'card', text: TEXT.cardPrompt }],
  ['set_welcome', { prompt: 'welcome', text: TEXT.welcomePrompt }],
  ['broadcast', { prompt: 'broadcast', text: TEXT.broadcastPrompt }],
]);

const AUDIENCE = {
  blockedBot: false,
  orders: { some: { status: { not: 'CANCELLED' } } },
} satisfies Prisma.MerchCustomerWhereInput;

const SUPPORT_KEYBOARD = {
  keyboard: [[{ text: TEXT.supportButton }]],
  resize_keyboard: true,
};

/** A web_app button, or nothing without an https URL. */
const webApp = (text: string, url?: string) =>
  url
    ? { reply_markup: { inline_keyboard: [[{ text, web_app: { url } }]] } }
    : {};

const confirmButtons = (yes: string, data: string, no: string) => ({
  reply_markup: {
    inline_keyboard: [
      [
        { text: yes, callback_data: data },
        { text: TEXT.cancelButton, callback_data: no },
      ],
    ],
  },
});

const staffName = (user: User) =>
  [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Менеджер';

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
const unixNow = () => Math.floor(Date.now() / 1000);

/** Queued clicks survive the switch, and Telegram refuses to answer old ones. Fine. */
const answer = (ctx: Context, other?: AnswerOptions) =>
  ctx.answerCallbackQuery(other).catch(() => {});

/** All grammY handlers of @merch_ficebot, attached before polling starts. */
@Injectable()
export class MerchChatService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MerchChatService.name);
  // Each chat keeps its order; no chat holds up another or the polling loop.
  // ponytail: per-chat chain inside TaskQueue(8) instead of @grammyjs/runner, no
  // new dependency. A crash between the offset and the end of a handler loses
  // that one update.
  private readonly tails = new Map<number, Promise<void>>();
  private readonly queue = new TaskQueue(8);
  private owners: number[] = [];
  private broadcast?: {
    total: number;
    sent: number;
    failed: number;
    stopped: boolean;
  };
  private broadcastDone?: Promise<void>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: MerchBotService,
    private readonly sync: MerchSyncService,
    private readonly config: ConfigService,
  ) {}

  private get api() {
    return this.bot.telegram!.api;
  }

  onModuleInit() {
    const bot = this.bot.telegram;
    if (!bot) return;
    this.owners = parseOwnerIds(this.config.get<string>('MERCH_OWNER_IDS'));

    // A late next() is safe: concat in grammY only guards a second call. Errors no
    // longer reach bot.catch, hence the chain's own catch.
    bot.use((ctx, next) => {
      const key = ctx.chat?.id ?? ctx.from?.id ?? 0;
      const run = (this.tails.get(key) ?? Promise.resolve())
        .then(() => this.queue.run(() => next()))
        .catch((err) => {
          this.logger.warn('Merch update failed: ' + errorMessage(err));
        });
      this.tails.set(key, run);
      void run.finally(() => {
        if (this.tails.get(key) === run) this.tails.delete(key);
      });
    });

    // A chatType composer takes its place in the chain when it is created, so each
    // tree below is one block. They never overlap, and within a block order holds.
    const dm = bot.chatType('private');
    const groups = bot.chatType(['group', 'supergroup']);

    dm.command('start', (ctx) =>
      this.guarded(ctx, () => this.onStart(ctx, ctx.match)),
    );
    dm.command('support', (ctx) =>
      this.guarded(ctx, () => this.askSupport(ctx, TEXT.supportPromptCommand)),
    );
    dm.hears(TEXT.supportButton, (ctx) =>
      this.guarded(ctx, () => this.askSupport(ctx, TEXT.supportPromptButton)),
    );
    dm.command('admin', (ctx) => this.guarded(ctx, () => this.onAdmin(ctx)));
    dm.command('clear_orders', (ctx) =>
      this.guarded(ctx, () => this.onClearOrders(ctx)),
    );
    dm.on('my_chat_member', (ctx) =>
      this.guarded(ctx, () =>
        this.sync.setBlocked(
          BigInt(ctx.from.id),
          ctx.myChatMember.new_chat_member.status === 'kicked',
        ),
      ),
    );

    groups.command('bind_admin_chat', (ctx) =>
      this.guarded(ctx, () => this.onBind(ctx, ctx.chat.title)),
    );
    groups.command('setthreads', (ctx) =>
      this.guarded(ctx, () => this.onSetThreads(ctx, ctx.match)),
    );
    groups.on('message:migrate_to_chat_id', (ctx) =>
      this.guarded(ctx, () => this.onMigrated(ctx, ctx.msg.migrate_to_chat_id)),
    );

    bot.on('callback_query:data', (ctx) =>
      this.guarded(ctx, () => this.onButton(ctx)),
    );

    dm.on('message', (ctx) =>
      this.guarded(ctx, () => this.onPrivateMessage(ctx)),
    );
    groups.on('message', (ctx) =>
      this.guarded(ctx, () => this.onChatMessage(ctx)),
    );
  }

  /** For specs and shutdown. */
  settled(): Promise<unknown> {
    return Promise.allSettled([...this.tails.values()]);
  }

  async onModuleDestroy() {
    this.stopBroadcast();
    await Promise.race([
      Promise.all([this.settled(), this.broadcastDone]),
      new Promise((done) => setTimeout(done, SHUTDOWN_WAIT_MS).unref()),
    ]);
  }

  /** A failure in a handler becomes text, so a Telegram outage never reads as "no access". */
  private async guarded(ctx: Context, handler: () => Promise<unknown>) {
    try {
      await handler();
    } catch (err) {
      const text =
        err instanceof HttpException ? err.message : TEXT.somethingWrong;
      if (!(err instanceof HttpException)) {
        this.logger.warn('Merch handler failed: ' + errorMessage(err));
      }
      if (ctx.callbackQuery) {
        await answer(ctx, { text: text.slice(0, 200), show_alert: true });
      } else if (ctx.msg) {
        await ctx
          .reply(text, {
            reply_parameters: {
              message_id: ctx.msg.message_id,
              allow_sending_without_reply: true,
            },
          })
          .catch(() => {});
      }
    }
  }

  // ---- Customer row -----------------------------------------------------------

  private upsertCustomer(
    from: User,
    state: { prompt: string | null; promptUntil: Date | null },
  ) {
    const telegramId = BigInt(from.id);
    const row = {
      username: from.username?.toLowerCase() ?? null,
      firstName: from.first_name,
      lastName: from.last_name ?? null,
      ...state,
    };
    return this.prisma.merchCustomer.upsert({
      where: { telegramId },
      create: { telegramId, ...row },
      update: row,
    });
  }

  private setPrompt(from: User, prompt: string, ms: number) {
    return this.upsertCustomer(from, {
      prompt,
      promptUntil: new Date(Date.now() + ms),
    });
  }

  private clearPrompt(id: number) {
    return this.prisma.merchCustomer.updateMany({
      where: { telegramId: BigInt(id), prompt: { not: null } },
      data: { prompt: null, promptUntil: null },
    });
  }

  // ---- /start and deep links --------------------------------------------------

  private async onStart(ctx: Context, payload: string) {
    await this.upsertCustomer(ctx.from!, { prompt: null, promptUntil: null });
    await this.sync.setBlocked(BigInt(ctx.from!.id), false);
    const start = parseStart(payload);
    if (start.kind === 'link') return this.offerLink(ctx, start.token);
    if (start.kind === 'item') {
      // No DB read, so a restricted title cannot leak.
      await ctx.reply(
        TEXT.itemLink,
        webApp(TEXT.itemButton, this.bot.appUrl(`/${start.id}`)),
      );
      return this.supportHint(ctx);
    }
    const shop = await this.bot.shopConfig();
    await ctx.reply(shop.welcomeText, { reply_markup: SUPPORT_KEYBOARD });
    const product = await this.prisma.merchProduct.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    await ctx.reply(
      product ? TEXT.startHint : TEXT.startNoProducts,
      webApp(TEXT.catalogButton, this.bot.appUrl()),
    );
  }

  /** Link and item customers never pass plain /start, and an edit cannot attach a reply keyboard. */
  private supportHint(ctx: Context) {
    return ctx.reply(TEXT.startHint, { reply_markup: SUPPORT_KEYBOARD });
  }

  /**
   * The button carries the token, not a row id: callback data is client supplied,
   * so an id would let anyone bind every pending web login to their own account.
   */
  private async offerLink(ctx: Context, token: string) {
    const link = await this.prisma.merchLink.findUnique({
      where: { linkToken: token },
    });
    if (!link || link.expiresAt <= new Date() || link.telegramId !== null) {
      return ctx.reply(TEXT.linkStale);
    }
    await ctx.reply(TEXT.linkOffer, {
      reply_markup: {
        inline_keyboard: [
          [{ text: TEXT.linkConfirmButton, callback_data: `link:${token}` }],
        ],
      },
    });
  }

  private async onLinkButton(ctx: ButtonContext, token?: string) {
    if (token === 'off') {
      // Keys only on the sender, so forged data can hurt only them.
      await this.prisma.merchLink.deleteMany({
        where: { telegramId: BigInt(ctx.from.id) },
      });
      return answer(ctx, { text: TEXT.linkRevoked });
    }
    if (!token || !TOKEN.test(token) || ctx.chat?.type !== 'private') {
      return answer(ctx);
    }
    const { count } = await this.prisma.merchLink.updateMany({
      where: {
        linkToken: token,
        telegramId: null,
        expiresAt: { gt: new Date() },
      },
      data: { telegramId: BigInt(ctx.from.id) },
    });
    if (!count) return answer(ctx, { text: TEXT.linkStale, show_alert: true });
    await answer(ctx);
    await ctx.editMessageText(TEXT.linkDone, {
      reply_markup: {
        inline_keyboard: [
          [{ text: TEXT.linkNotMeButton, callback_data: 'link:off' }],
        ],
      },
    });
    await this.supportHint(ctx);
  }

  // ---- Commands ---------------------------------------------------------------

  private async askSupport(ctx: Context, prompt: string) {
    await this.setPrompt(ctx.from!, 'support', SUPPORT_PROMPT_MS);
    await ctx.reply(prompt);
  }

  private async panel() {
    const { dayfEnabled } = await this.bot.shopConfig();
    return adminKeyboard(this.bot.appUrl('/admin'), dayfEnabled);
  }

  private async onAdmin(ctx: Context) {
    await this.clearPrompt(ctx.from!.id);
    if (!(await this.bot.isShopAdmin(ctx.from!.id))) {
      return ctx.reply(TEXT.panelDenied);
    }
    await ctx.reply(TEXT.panel, { reply_markup: await this.panel() });
  }

  private async onClearOrders(ctx: Context) {
    if (!(await this.bot.isShopAdmin(ctx.from!.id))) {
      return ctx.reply(TEXT.commandDenied);
    }
    const count = await this.prisma.merchOrder.count();
    await ctx.reply(
      clearAsk(count),
      confirmButtons(TEXT.clearYesButton, `co:go:${unixNow()}`, 'co:no'),
    );
  }

  /** Direct check on this chat: bind and setthreads run where no shop admin exists yet. */
  private async isChatAdmin(ctx: Context) {
    const { status } = await ctx.getChatMember(ctx.from!.id);
    return status === 'administrator' || status === 'creator';
  }

  private async onBind(ctx: Context, title: string) {
    if (!this.owners.includes(ctx.from!.id)) {
      return ctx.reply(TEXT.bindDenied);
    }
    if (!(await this.isChatAdmin(ctx))) return;
    const shop = await this.bot.shopConfig();
    const adminChatId = BigInt(ctx.chat!.id);
    const moved = shop.adminChatId !== adminChatId;
    await this.bot.updateShopConfig({
      adminChatId,
      adminChatTitle: title,
      ...(moved ? { ordersThreadId: null, supportThreadId: null } : {}),
    });
    if (moved) await this.sync.resendOpenCards();
    this.bot.clearAdminCache();
    this.bot.kick(); // waiting cards go out
    await ctx.reply(TEXT.bindDone);
  }

  private async onSetThreads(ctx: Context, args: string) {
    if (!(await this.isChatAdmin(ctx))) return;
    const threads = parseThreads(args);
    if (threads.orders === undefined && threads.support === undefined) {
      return ctx.reply(TEXT.threadsUsage);
    }
    const shop = await this.bot.shopConfig();
    if (shop.adminChatId !== BigInt(ctx.chat!.id)) {
      return ctx.reply(TEXT.threadsNotBound);
    }
    await this.bot.updateShopConfig({
      ordersThreadId: threads.orders,
      supportThreadId: threads.support,
    });
    await ctx.reply(threadsDone(threads));
  }

  private async onMigrated(ctx: Context, chatId: number) {
    const shop = await this.bot.shopConfig();
    if (shop.adminChatId !== BigInt(ctx.chat!.id)) return;
    await this.bot.updateShopConfig({ adminChatId: BigInt(chatId) });
    await this.sync.resendOpenCards();
    this.bot.clearAdminCache();
    this.bot.kick();
  }

  // ---- Buttons ----------------------------------------------------------------

  private async onButton(ctx: ButtonContext) {
    const { data } = ctx.callbackQuery;
    const [scope, action, ...args] = data.split(':');
    if (scope === 'ostatus') return this.onStatus(ctx, data);
    if (scope === 'ignore') return answer(ctx, { text: TEXT.terminalStatus });
    if (scope === 'link') return this.onLinkButton(ctx, action);
    if (scope !== 'admin' && scope !== 'bc' && scope !== 'co') {
      return answer(ctx);
    }
    if (!(await this.bot.isShopAdmin(ctx.from.id))) {
      return answer(ctx, { text: TEXT.panelDenied, show_alert: true });
    }
    if (scope === 'admin') return this.onAdminButton(ctx, action);
    if (action === 'no') {
      await answer(ctx);
      return ctx.editMessageText(TEXT.cancelled);
    }
    if (action !== 'go') return answer(ctx);
    return scope === 'co'
      ? this.onClearConfirm(ctx, Number(args[0]))
      : this.onBroadcastConfirm(ctx, Number(args[0]), Number(args[1]));
  }

  private async onStatus(ctx: ButtonContext, data: string) {
    const parsed = parseStatusCallback(data);
    if (!parsed) return answer(ctx);
    const shop = await this.bot.shopConfig();
    // `chat` survives on an inaccessible old message, `photo` does not.
    if (
      String(ctx.callbackQuery.message?.chat.id) !== String(shop.adminChatId)
    ) {
      return answer(ctx, { text: TEXT.wrongChat, show_alert: true });
    }
    const result = await this.sync.changeStatus(
      parsed.orderId,
      parsed.status,
      staffName(ctx.from),
    );
    void answer(ctx, result);
    this.bot.kick();
  }

  private async onAdminButton(ctx: ButtonContext, action: string) {
    const ask = ADMIN_PROMPTS.get(action);
    if (ask) {
      await this.setPrompt(ctx.from, ask.prompt, ADMIN_PROMPT_MS);
      await answer(ctx);
      return ctx.editMessageText(ask.text, {
        reply_markup: {
          inline_keyboard: [
            [{ text: TEXT.cancelButton, callback_data: 'admin:cancel' }],
          ],
        },
      });
    }
    if (action === 'dayf') {
      const shop = await this.bot.shopConfig();
      await this.bot.updateShopConfig({ dayfEnabled: !shop.dayfEnabled });
      await answer(ctx);
      return ctx.editMessageReplyMarkup({ reply_markup: await this.panel() });
    }
    if (action === 'cancel') {
      await this.clearPrompt(ctx.from.id);
      await answer(ctx);
      return ctx.editMessageText(TEXT.panel, {
        reply_markup: await this.panel(),
      });
    }
    return answer(ctx);
  }

  private async onClearConfirm(ctx: ButtonContext, sentAt: number) {
    await answer(ctx);
    // First, so a second tap queued behind this one finds no buttons and fails here.
    await ctx.editMessageReplyMarkup();
    if (!isFreshConfirm(sentAt, unixNow(), CONFIRM_TTL_S.clearOrders)) {
      return ctx.editMessageText(TEXT.clearExpired);
    }
    await this.prisma.merchOrder.deleteMany();
    await ctx.editMessageText(TEXT.clearDone);
  }

  // ---- Private messages -------------------------------------------------------

  private async onPrivateMessage(ctx: Context) {
    const msg = ctx.msg!;
    const telegramId = ctx.from!.id;
    if (msg.text?.startsWith('/')) {
      // So /something during a broadcast prompt can never reach customers.
      await this.clearPrompt(telegramId);
      return;
    }
    const customer = await this.prisma.merchCustomer.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });
    if (customer?.prompt && customer.promptUntil! > new Date()) {
      return this.onPrompt(ctx, customer.prompt);
    }
    const replied = msg.reply_to_message;
    const quoted = replied?.text ?? replied?.caption ?? '';
    if (
      replied?.from?.id === ctx.me.id &&
      (quoted.includes('Відповідь від адміністратора') ||
        quoted.includes('Ваше повідомлення надіслано'))
    ) {
      return this.relayToAdmins(ctx, 'reply');
    }
  }

  private async onPrompt(ctx: Context, prompt: string) {
    if (prompt === 'support') return this.relayToAdmins(ctx, 'new');
    const from = ctx.from!;
    if (!(await this.bot.isShopAdmin(from.id))) {
      await this.clearPrompt(from.id);
      return ctx.reply(TEXT.panelDenied);
    }
    if (prompt === 'broadcast') return this.previewBroadcast(ctx);

    const text = ctx.msg!.text?.trim();
    if (!text) return ctx.reply(TEXT.textRequired);
    let done: string;
    if (prompt === 'mono') {
      if (!text.startsWith('https://') || text.length > 255) {
        return ctx.reply(TEXT.monoInvalid);
      }
      await this.bot.updateShopConfig({ monoJarUrl: text });
      done = TEXT.monoDone;
    } else if (prompt === 'card') {
      if (!/^[\d ]{1,20}$/.test(text)) return ctx.reply(TEXT.cardInvalid);
      await this.bot.updateShopConfig({
        cardNumber: text === '0' ? null : text,
      });
      done = TEXT.cardDone;
    } else {
      if (text.length > 4000) return ctx.reply(TEXT.textRequired);
      await this.bot.updateShopConfig({ welcomeText: text });
      done = TEXT.welcomeDone;
    }
    await this.clearPrompt(from.id);
    await ctx.reply(done, { reply_markup: await this.panel() });
  }

  // ---- Support relay ----------------------------------------------------------
  // Every relayed item is one message with #T<id> in its text or caption. Routing
  // reads that tag on the replied message, so restarts lose nothing.

  private async relayToAdmins(ctx: Context, kind: 'new' | 'reply') {
    const shop = await this.bot.shopConfig();
    if (!shop.adminChatId) return ctx.reply(TEXT.noAdminChat);
    const chat = Number(shop.adminChatId);
    const msg = ctx.msg!;
    const header = supportHeader(
      kind,
      ctx.from!,
      msg.text ?? msg.caption ?? TEXT.noBody,
    );
    try {
      await inThread(
        shop.supportThreadId,
        async (thread) => {
          if (CAPTIONED.some((k) => msg[k]) && header.length <= CAPTION_LIMIT) {
            await this.api.copyMessage(chat, ctx.chat!.id, msg.message_id, {
              caption: header,
              message_thread_id: thread,
            });
            return;
          }
          const meta = await this.api.sendMessage(
            chat,
            header.slice(0, TEXT_LIMIT),
            { message_thread_id: thread },
          );
          if (msg.text) return;
          await this.api
            .copyMessage(chat, ctx.chat!.id, msg.message_id, {
              // The text is in the header; a kept caption could forge one.
              ...(msg.caption ? { caption: '' } : {}),
              reply_parameters: {
                message_id: meta.message_id,
                allow_sending_without_reply: true,
              },
            })
            .catch(() => {});
        },
        this.logger,
      );
    } catch {
      return ctx.reply(TEXT.supportFailed); // prompt stays
    }
    await this.clearPrompt(ctx.from!.id);
    await ctx.reply(TEXT.supportSent);
  }

  /** The last handler of a group, cheapest test first, so chatter makes no DB or Telegram call. */
  private async onChatMessage(ctx: Context) {
    const replied = ctx.msg!.reply_to_message;
    const target =
      replied?.from?.id === ctx.me.id
        ? supportTarget(replied.text ?? replied.caption ?? '')
        : null;
    if (!target) return;
    const shop = await this.bot.shopConfig();
    if (String(ctx.chat!.id) !== String(shop.adminChatId)) return;
    if (await this.bot.isShopAdmin(ctx.from!.id)) {
      await this.replyToCustomer(ctx, BigInt(target));
    }
  }

  private async replyToCustomer(ctx: Context, target: bigint) {
    const msg = ctx.msg!;
    const chat = Number(target);
    const text =
      TEXT.adminAnswerPrefix + (msg.text ?? msg.caption ?? TEXT.noBody);
    try {
      if (CAPTIONED.some((k) => msg[k]) && text.length <= CAPTION_LIMIT) {
        await this.api.copyMessage(chat, ctx.chat!.id, msg.message_id, {
          caption: text,
        });
      } else {
        await this.api.sendMessage(chat, text.slice(0, TEXT_LIMIT));
        if (!msg.text) {
          await this.api.copyMessage(
            chat,
            ctx.chat!.id,
            msg.message_id,
            msg.caption ? { caption: '' } : {},
          );
        }
      }
    } catch (err) {
      if (telegramFailure(err).kind !== 'blocked') {
        return ctx.reply(TEXT.replyFailed);
      }
      await this.sync.setBlocked(target, true);
      return ctx.reply(TEXT.replyBlocked);
    }
    await ctx.react('👍').catch(() => {}); // delivered either way
  }

  // ---- Broadcast --------------------------------------------------------------

  private async previewBroadcast(ctx: Context) {
    await this.clearPrompt(ctx.from!.id);
    const chat = ctx.chat!.id;
    const messageId = ctx.msg!.message_id;
    try {
      await this.api.copyMessage(chat, chat, messageId);
    } catch {
      return ctx.reply(TEXT.broadcastUncopyable);
    }
    const n = await this.prisma.merchCustomer.count({ where: AUDIENCE });
    // All state is in the button, so a restart changes nothing.
    await ctx.reply(
      broadcastAsk(n),
      confirmButtons(
        TEXT.broadcastSendButton,
        `bc:go:${messageId}:${unixNow()}`,
        'bc:no',
      ),
    );
  }

  private async onBroadcastConfirm(
    ctx: ButtonContext,
    messageId: number,
    sentAt: number,
  ) {
    await answer(ctx);
    await ctx.editMessageReplyMarkup();
    if (!isFreshConfirm(sentAt, unixNow(), CONFIRM_TTL_S.broadcast)) {
      return ctx.editMessageText(TEXT.broadcastExpired);
    }
    if (this.broadcast) return ctx.editMessageText(TEXT.broadcastRunning);
    // The count of the preview: the one number on the message this button is on.
    const n = /\d+/.exec(ctx.msg?.text ?? '')?.[0] ?? '0';
    // Detached, outside the queue, so it never holds a slot for minutes.
    this.broadcastDone = this.runBroadcast(ctx.chat!.id, messageId).catch(
      (err) => {
        this.logger.warn('Merch broadcast failed: ' + errorMessage(err));
      },
    );
    await ctx.reply(broadcastStarted(Number(n)));
  }

  private async runBroadcast(chatId: number, messageId: number) {
    const run = { total: 0, sent: 0, failed: 0, stopped: false };
    this.broadcast = run; // before any await: a second bc:go meets it
    try {
      const audience = await this.prisma.merchCustomer.findMany({
        where: AUDIENCE,
        select: { telegramId: true },
      });
      run.total = audience.length;
      for (const { telegramId } of audience) {
        if (run.stopped) break;
        if (await this.copyWithRetry(telegramId, chatId, messageId)) run.sent++;
        else run.failed++;
        await sleep(BROADCAST_GAP_MS);
      }
    } finally {
      this.broadcast = undefined;
    }
    await this.api.sendMessage(
      chatId,
      run.stopped
        ? broadcastStopped(run.sent, run.total)
        : broadcastFinished(run.sent, run.failed),
      run.stopped ? {} : { reply_markup: await this.panel() },
    );
  }

  // ponytail: a restart during a long retry_after can outlast the 8 s shutdown
  // wait and lose the stop report; break the sleep on `stopped` if that matters.
  private async copyWithRetry(
    telegramId: bigint,
    fromChat: number,
    messageId: number,
  ): Promise<boolean> {
    for (let attempt = 1; ; attempt++) {
      try {
        await this.api.copyMessage(Number(telegramId), fromChat, messageId);
        return true;
      } catch (err) {
        const failure = telegramFailure(err);
        if (failure.kind === 'rate' && attempt < BROADCAST_TRIES) {
          await sleep(failure.seconds * 1000);
          continue;
        }
        if (failure.kind === 'blocked') {
          await this.sync.setBlocked(telegramId, true).catch(() => {});
        }
        this.logger.warn(
          `Merch broadcast to ${telegramId} failed: ${errorMessage(err)}`,
        );
        return false;
      }
    }
  }

  // ponytail: progress is in memory; a restart stops it and reports the count.
  // Add a table with a cursor if lists reach thousands.
  private stopBroadcast() {
    if (this.broadcast) this.broadcast.stopped = true;
  }
}
