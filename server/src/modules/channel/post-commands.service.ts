import {
  HttpException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NewsCategory } from '@prisma/client';
import {
  CommandContext,
  Context,
  Filter,
  GrammyError,
  NextFunction,
} from 'grammy';
import type { InlineKeyboardButton, Message, User } from 'grammy/types';
import { BotService, parseChatRef } from '../../bot/bot.service';
import { escapeHtml } from '../../common/html';
import { errorMessage } from '../../common/log-safe';
import { PrismaService } from '../../database/prisma.service';
import { upcomingEventsWhere } from '../event/event-timing';
import {
  ButtonChoice,
  ChannelService,
  HANDLED,
  PostKind,
  QueueItem,
} from './channel.service';
import {
  BOT_DOWNLOAD_LIMIT,
  entitiesToHtml,
  excerpt,
  formatKyiv,
  fromShortId,
  lengthProblem,
  mediaOf,
  MediaType,
  parseButtonLine,
  parseKyivDateTime,
  PostMedia,
  shortId,
  sourceProblem,
} from './post-format';
import { PublishAccessService } from './publish-access.service';

const SESSION_TTL_MS = 30 * 60_000;

const CATEGORIES: [NewsCategory, string][] = [
  ['EVENTS', 'Події'],
  ['EDUCATION', 'Освіта'],
  ['PARTNERS', 'Партнерства'],
  ['CHARITY', 'Благодійність'],
  ['ACHIEVEMENTS', 'Досягнення'],
];
const MEDIA_NAMES: Record<MediaType, string> = {
  photo: 'фото',
  video: 'відео',
  animation: 'GIF',
};

type Step =
  | 'title'
  | 'category'
  | 'when'
  | 'time'
  | 'button'
  | 'event'
  | 'link'
  | 'confirm'
  | 'text'
  | 'delete';

/** A post being prepared with /post or /site. */
interface Draft {
  kind: PostKind;
  text: string;
  media?: PostMedia;
  sourceId: number;
  title?: string;
  category?: NewsCategory | null;
  /** Unset: right away. */
  publishAt?: Date;
  button?: ButtonChoice | null;
  buttonLabel?: string;
  canPublish: boolean;
}

/** One person's dialog: a new post (draft) or a change to a queued one (target). */
interface Session {
  userId: number;
  /** The bot message the dialog keeps editing. */
  promptId: number;
  step: Step;
  at: number;
  draft?: Draft;
  target?: { kind: PostKind; id: string };
}

interface View {
  text: string;
  rows: InlineKeyboardButton[][];
}

type ButtonContext = Filter<Context, 'callback_query:data'>;

const btn = (text: string, data: string): InlineKeyboardButton => ({
  text,
  callback_data: data,
});
const CANCEL = btn('Скасувати', 'pd:cancel');
const BACK = btn('Назад', 'pd:back');
const code = (kind: PostKind) => (kind === 'site' ? 's' : 'c');
const kindOf = (c?: string): PostKind => (c === 's' ? 'site' : 'channel');
const who = (u: User) => (u.username ? `@${u.username}` : u.first_name);
const title = (kind: PostKind) =>
  kind === 'site' ? 'Новина на сайт' : 'Пост у канал';
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const categoryName = (c?: NewsCategory | null) =>
  CATEGORIES.find(([v]) => v === c)?.[1] ?? 'без категорії';

/**
 * /post (channel) and /site (news) as a reply to a ready post, and /queue, in
 * one topic of the media chat (MEDIA_POST_CHAT_ID). People without access get
 * their post sent for approval to those who have it.
 */
@Injectable()
export class PostCommandsService implements OnModuleInit {
  private readonly logger = new Logger(PostCommandsService.name);
  // ponytail: in-memory dialogs, a restart drops the half-made ones; the
  // posts themselves are in the database.
  private readonly sessions = new Map<number, Session>();
  private chat?: { chatId: string; threadId?: number };

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly bot: BotService,
    private readonly channel: ChannelService,
    private readonly access: PublishAccessService,
  ) {}

  private get api() {
    return this.bot.telegram!.api;
  }

  onModuleInit() {
    const bot = this.bot.telegram;
    this.chat = parseChatRef(this.config.get<string>('MEDIA_POST_CHAT_ID'));
    if (!bot) return;
    if (!this.chat?.chatId) {
      this.logger.warn(
        'MEDIA_POST_CHAT_ID is not set — /post, /site and /queue are off.',
      );
      return;
    }

    bot.command('post', (ctx, next) =>
      this.inChat(ctx, next, () => this.start(ctx, 'channel')),
    );
    bot.command('site', (ctx, next) =>
      this.inChat(ctx, next, () => this.start(ctx, 'site')),
    );
    bot.command('queue', (ctx, next) =>
      this.inChat(ctx, next, () => this.showQueue(ctx)),
    );
    bot.on('callback_query:data', (ctx, next) =>
      this.inChat(ctx, next, () => this.onButton(ctx)),
    );
    bot.on('message', (ctx, next) => this.onMessage(ctx, next));

    void this.api
      .setMyCommands(
        [
          { command: 'post', description: 'У канал: реплаєм на готовий пост' },
          { command: 'site', description: 'На сайт: реплаєм на готовий пост' },
          { command: 'queue', description: 'Черга відкладених публікацій' },
        ],
        { scope: { type: 'chat', chat_id: this.chat.chatId } },
      )
      .catch((err) =>
        this.logger.warn(
          'Failed to set media chat commands: ' + errorMessage(err),
        ),
      );
  }

  private here(ctx: Context): boolean {
    const msg = ctx.msg;
    return (
      !!msg &&
      !ctx.editedMessage &&
      String(msg.chat.id) === this.chat?.chatId &&
      (this.chat.threadId === undefined ||
        msg.message_thread_id === this.chat.threadId)
    );
  }

  /** Runs a handler for the media topic; shows its errors in the chat. */
  private async inChat(
    ctx: Context,
    next: NextFunction,
    handler: () => Promise<unknown>,
  ) {
    if (!this.here(ctx) || !ctx.from) return next();
    try {
      await handler();
    } catch (err) {
      const text =
        err instanceof HttpException
          ? err.message
          : 'Щось пішло не так, спробуй ще раз.';
      if (!(err instanceof HttpException)) {
        this.logger.warn('Media chat command failed: ' + errorMessage(err));
      }
      if (ctx.callbackQuery) {
        await ctx
          .answerCallbackQuery({ text: text.slice(0, 200), show_alert: true })
          .catch(() => {});
      } else {
        await ctx
          .reply(text, {
            reply_parameters: {
              message_id: ctx.msg!.message_id,
              allow_sending_without_reply: true,
            },
          })
          .catch(() => {});
      }
    }
  }

  private async editPrompt(messageId: number, view: View) {
    try {
      await this.api.editMessageText(this.chat!.chatId, messageId, view.text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: view.rows },
        link_preview_options: { is_disabled: true },
      });
    } catch (err) {
      if (
        !(err instanceof GrammyError) ||
        !err.description.includes('message is not modified')
      ) {
        throw err;
      }
    }
  }

  // ---- /post and /site --------------------------------------------------------

  private async start(ctx: CommandContext<Context>, kind: PostKind) {
    const src = ctx.msg.reply_to_message;
    const reply = (text: string) =>
      ctx.reply(text, { reply_parameters: { message_id: ctx.msg.message_id } });
    // In a forum topic a plain message "replies" to the topic's first message.
    if (!src || src.forum_topic_created) {
      return reply(
        `Напиши /${kind === 'site' ? 'site' : 'post'} у відповідь на готовий пост.`,
      );
    }
    const problem = sourceProblem(src);
    if (problem) return reply(problem);
    const media = mediaOf(src);
    const text = entitiesToHtml(
      src.text ?? src.caption ?? '',
      src.entities ?? src.caption_entities,
      kind,
    );
    if (kind === 'channel') {
      if (!this.config.get<string>('TELEGRAM_CHANNEL_ID')) {
        return reply('Канал не налаштований (TELEGRAM_CHANNEL_ID).');
      }
      const tooLong = lengthProblem(text, !!media);
      if (tooLong) return reply(tooLong);
    } else if ((media?.size ?? 0) > BOT_DOWNLOAD_LIMIT) {
      return reply(
        'Файл більший за 20 МБ: бот не може завантажити його на сайт. Стисни його або додай новину в міні-апці.',
      );
    }

    const s: Session = {
      userId: ctx.from!.id,
      promptId: 0,
      step: kind === 'site' ? 'title' : 'when',
      at: Date.now(),
      draft: {
        kind,
        text,
        media,
        sourceId: src.message_id,
        canPublish: await this.access.canPublish(ctx.from!),
      },
    };
    const view = await this.view(s);
    const prompt = await ctx.reply(view.text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: view.rows },
      reply_parameters: {
        message_id: src.message_id,
        allow_sending_without_reply: true,
      },
      link_preview_options: { is_disabled: true },
    });
    s.promptId = prompt.message_id;
    this.sessions.set(s.userId, s);
  }

  private summary(d: Draft): string {
    return [
      ...(d.kind === 'site'
        ? [`Заголовок: «${d.title}»`, `Категорія: ${categoryName(d.category)}`]
        : []),
      `Коли: ${d.publishAt ? formatKyiv(d.publishAt) : 'одразу'}`,
      `Кнопка: ${d.buttonLabel ?? 'без кнопки'}`,
      ...(d.media ? [`Медіа: ${MEDIA_NAMES[d.media.type]}`] : []),
    ].join('\n');
  }

  private upcomingEvents() {
    return this.prisma.event.findMany({
      where: {
        isDraft: false,
        noRegistration: false,
        ...upcomingEventsWhere(new Date()),
      },
      orderBy: { date: 'asc' },
      take: 8,
      select: { id: true, name: true, date: true },
    });
  }

  private async view(s: Session): Promise<View> {
    const d = s.draft;
    const kind = d?.kind ?? s.target!.kind;
    const head = `<b>${title(kind)}${d ? '' : ': зміна'}</b>\n\n`;
    switch (s.step) {
      case 'title':
        return {
          text: `${head}Напиши у відповідь заголовок новини (до 50 символів).`,
          rows: [[CANCEL]],
        };
      case 'category':
        return {
          text: `${head}Обери категорію новини:`,
          rows: [
            CATEGORIES.slice(0, 3).map(([v, n]) => btn(n, `pd:cat:${v}`)),
            CATEGORIES.slice(3).map(([v, n]) => btn(n, `pd:cat:${v}`)),
            [btn('Без категорії', 'pd:cat:none')],
            [CANCEL],
          ],
        };
      case 'when':
        return {
          text: `${head}Коли публікувати?`,
          rows: [
            [btn('Зараз', 'pd:now'), btn('Запланувати', 'pd:later')],
            [CANCEL],
          ],
        };
      case 'time':
        return {
          text: `${head}Напиши у відповідь дату й час за Києвом, наприклад <code>17.10 18:30</code> (або лише <code>18:30</code> — сьогодні).`,
          rows: [[BACK, CANCEL]],
        };
      case 'button':
        return {
          text: `${head}Додати кнопку під ${kind === 'site' ? 'новиною' : 'постом'}?`,
          rows: [
            [btn('Без кнопки', 'pd:btn:none')],
            [btn('Реєстрація на захід СР', 'pd:btn:event')],
            [btn('Інша лінка', 'pd:btn:link')],
            [CANCEL],
          ],
        };
      case 'event': {
        const events = await this.upcomingEvents();
        return {
          text: events.length
            ? `${head}Обери захід — кнопка відкриє реєстрацію в боті:`
            : `${head}Немає майбутніх заходів з відкритою реєстрацією.`,
          rows: [
            ...events.map((e) => [
              btn(
                `${e.name} · ${formatKyiv(e.date)}`,
                `pd:ev:${shortId(e.id)}`,
              ),
            ]),
            [BACK, CANCEL],
          ],
        };
      }
      case 'link':
        return {
          text: `${head}Напиши у відповідь підпис кнопки й посилання, наприклад:\n<code>Анкета https://forms.gle/abc</code>`,
          rows: [[BACK, CANCEL]],
        };
      case 'confirm':
        return {
          text:
            `${head}${escapeHtml(this.summary(d!))}\n\n` +
            (d!.canPublish
              ? d!.publishAt
                ? 'Запланувати?'
                : 'Публікуємо?'
              : 'У тебе немає доступу до публікацій, тож бот попросить схвалення в тих, хто його має. Надіслати?'),
          rows: [
            [
              btn(
                d!.canPublish
                  ? d!.publishAt
                    ? 'Запланувати'
                    : 'Опублікувати'
                  : 'Надіслати на схвалення',
                'pd:ok',
              ),
            ],
            [CANCEL],
          ],
        };
      case 'text':
        return {
          text: `${head}Надішли у відповідь новий текст — форматування збережеться.`,
          rows: [[CANCEL]],
        };
      case 'delete':
        return {
          text: `${head}Видалити цей пост із черги?`,
          rows: [[btn('Так, видалити', 'pd:ok'), btn('Ні', 'pd:cancel')]],
        };
    }
  }

  private async finish(ctx: ButtonContext, s: Session) {
    const d = s.draft!;
    this.sessions.delete(s.userId);
    const done = (text: string) =>
      this.editPrompt(s.promptId, { text, rows: [] });
    try {
      let id: string;
      if (d.kind === 'channel') {
        const post = await this.channel.createFromChat({
          text: d.text,
          media: d.media,
          button: d.button ?? null,
          publishAt: d.publishAt,
          author: who(ctx.from),
          sourceMessageId: d.sourceId,
          approved: d.canPublish,
        });
        id = post.id;
        if (d.canPublish && !d.publishAt) {
          const messageId = await this.channel.publishOrDrop(post.id);
          return done(
            `Опубліковано в каналі: ${this.channel.postLink(messageId!)}`,
          );
        }
      } else {
        if (d.media) await done('Завантажую фото чи відео…');
        const news = await this.channel.createNews({
          title: d.title!,
          text: d.text,
          media: d.media,
          category: d.category ?? null,
          button: d.button ?? null,
          publishAt: d.publishAt,
          approved: d.canPublish,
        });
        id = news.id;
        if (d.canPublish && !d.publishAt) {
          return done(`Опубліковано на сайті: ${this.channel.newsLink(id)}`);
        }
      }
      if (d.canPublish) {
        return done(
          `Заплановано на ${formatKyiv(d.publishAt!)}.\nЗмінити чи скасувати: /queue або міні-апка → Публікації.`,
        );
      }
      await this.requestApproval(ctx.from, s, d, id);
    } catch (err) {
      await done(`Не вдалося: ${escapeHtml(errorMessage(err))}`);
    }
  }

  private async requestApproval(from: User, s: Session, d: Draft, id: string) {
    const mine = from.username ? `@${from.username.toLowerCase()}` : '';
    const pings = (await this.access.approverTags()).filter((t) => t !== mine);
    const ref = `${code(d.kind)}:${shortId(id)}`;
    const text = [
      pings.join(' '),
      `${who(from)} просить опублікувати цей пост ${d.kind === 'site' ? 'на сайті' : 'в каналі'}.`,
      this.summary(d),
    ]
      .filter(Boolean)
      .join('\n');
    await this.api.deleteMessage(this.chat!.chatId, s.promptId).catch(() => {});
    await this.api.sendMessage(this.chat!.chatId, text, {
      message_thread_id: this.chat!.threadId,
      reply_parameters: {
        message_id: d.sourceId,
        allow_sending_without_reply: true,
      },
      reply_markup: {
        inline_keyboard: [
          [btn('Опублікувати', `pa:${ref}`), btn('Відхилити', `pr:${ref}`)],
        ],
      },
      link_preview_options: { is_disabled: true },
    });
  }

  // ---- /queue -----------------------------------------------------------------

  private async showQueue(ctx: CommandContext<Context>) {
    if (!(await this.access.canPublish(ctx.from!))) {
      return ctx.reply(
        'Черга доступна лише тим, кому видано доступ до публікацій.',
        { reply_parameters: { message_id: ctx.msg.message_id } },
      );
    }
    const view = await this.queueView();
    await ctx.reply(view.text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: view.rows },
      link_preview_options: { is_disabled: true },
    });
  }

  private label(item: QueueItem): string {
    if (item.kind === 'site') return `Сайт: «${item.news.title}»`;
    const flag =
      item.post.status === 'PENDING'
        ? ' · чекає схвалення'
        : item.post.status === 'FAILED'
          ? ' · помилка'
          : '';
    return `Канал: ${excerpt(item.post.text, 50) || 'без тексту'}${flag}`;
  }

  private async queueView(note?: string): Promise<View> {
    const items = (await this.channel.queue()).slice(0, 20);
    const lines = items.map(
      (item, i) =>
        `${i + 1}. <b>${formatKyiv(item.publishAt)}</b> · ${escapeHtml(this.label(item))}`,
    );
    return {
      text: [
        ...(note ? [escapeHtml(note), ''] : []),
        '<b>Черга публікацій</b>',
        '',
        ...(lines.length ? lines : ['Порожньо: запланованих постів немає.']),
      ].join('\n'),
      rows: [
        ...items.map((item, i) => [
          btn(
            `${i + 1}. ${formatKyiv(item.publishAt)} · ${item.kind === 'site' ? 'Сайт' : 'Канал'}`,
            `pq:open:${code(item.kind)}:${shortId(item.id)}`,
          ),
        ]),
        [btn('Оновити', 'pq:list')],
      ],
    };
  }

  private async cardView(kind: PostKind, id: string, note?: string) {
    const item = await this.channel.item(kind, id);
    if (!item) return this.queueView('Цього поста вже немає в черзі.');
    const lines = [
      ...(note ? [escapeHtml(note), ''] : []),
      `<b>${kind === 'site' ? 'Сайт' : 'Канал'} · ${formatKyiv(item.publishAt)}</b>`,
    ];
    const link = (text: string | null, url: string) =>
      `«${escapeHtml(text || 'Перейти')}» → ${escapeHtml(url)}`;
    let body: string;
    if (item.kind === 'channel') {
      const p = item.post;
      if (p.status === 'PENDING') lines.push('Чекає схвалення');
      if (p.status === 'FAILED') {
        lines.push(`Не вдалося опублікувати: ${escapeHtml(p.error ?? '')}`);
      }
      lines.push(
        `Кнопка: ${p.buttonUrl ? link(p.buttonText, p.buttonUrl) : 'немає'}`,
        `Медіа: ${p.mediaType ? MEDIA_NAMES[p.mediaType as MediaType] : p.imageUrl ? 'є' : 'немає'}`,
        ...(p.author ? [`Автор: ${escapeHtml(p.author)}`] : []),
      );
      body = p.text;
    } else {
      const n = item.news;
      lines.push(
        `Заголовок: «${escapeHtml(n.title)}»`,
        `Категорія: ${categoryName(n.category)}`,
        `Кнопка: ${n.eventDate ? 'реєстрація на захід' : n.registrationLink ? link(n.buttonText, n.registrationLink) : 'немає'}`,
        `Обкладинка: ${n.image ? 'є' : 'немає'}`,
      );
      body = n.details ?? '';
    }
    lines.push('', `<i>${escapeHtml(excerpt(body, 300) || 'без тексту')}</i>`);
    const ref = `${code(kind)}:${shortId(id)}`;
    return {
      text: lines.join('\n'),
      rows: [
        [
          btn('Час', `pq:time:${ref}`),
          btn('Кнопка', `pq:btn:${ref}`),
          btn('Текст', `pq:text:${ref}`),
        ],
        ...(kind === 'site'
          ? [
              [
                btn('Заголовок', `pq:title:${ref}`),
                btn('Категорія', `pq:cat:${ref}`),
              ],
            ]
          : []),
        ...(item.kind === 'channel' && item.post.status === 'PENDING'
          ? [[btn('Схвалити', `pq:ok:${ref}`)]]
          : []),
        [
          btn('Опублікувати зараз', `pq:now:${ref}`),
          btn('Видалити', `pq:del:${ref}`),
        ],
        [btn('До черги', 'pq:list')],
      ],
    };
  }

  // ---- Buttons ----------------------------------------------------------------

  private async onButton(ctx: ButtonContext) {
    const [scope, ...args] = ctx.callbackQuery.data.split(':');
    if (scope === 'pd') return this.onDialog(ctx, args[0], args[1]);
    if (!['pq', 'pa', 'pr'].includes(scope)) return;
    if (!(await this.access.canPublish(ctx.from))) {
      await ctx.answerCallbackQuery({
        text: 'Це можуть лише ті, кому видано доступ до публікацій.',
        show_alert: true,
      });
      return;
    }
    if (scope === 'pq') {
      const id = args[2] ? fromShortId(args[2]) : null;
      await this.onQueueButton(ctx, args[0], kindOf(args[1]), id);
    } else {
      const id = fromShortId(args[1] ?? '');
      if (id) await this.onApproval(ctx, scope === 'pa', kindOf(args[0]), id);
    }
    await ctx.answerCallbackQuery().catch(() => {});
  }

  private async onApproval(
    ctx: ButtonContext,
    approve: boolean,
    kind: PostKind,
    id: string,
  ) {
    let verdict: string;
    try {
      if (approve) {
        verdict = `Схвалено (${who(ctx.from)}), ${await this.channel.approve(kind, id)}`;
      } else {
        await this.channel.reject(kind, id);
        verdict = `Відхилено (${who(ctx.from)})`;
      }
    } catch (err) {
      if (err instanceof HttpException && err.message === HANDLED) throw err;
      verdict = `Схвалено (${who(ctx.from)}), але не вдалося опублікувати: ${errorMessage(err)}. Пост чекає в черзі: /queue`;
    }
    const msg = ctx.callbackQuery.message as Message | undefined;
    await ctx.editMessageText(`${msg?.text ?? ''}\n\n${verdict}`, {
      link_preview_options: { is_disabled: true },
    });
  }

  private async onQueueButton(
    ctx: ButtonContext,
    action: string,
    kind: PostKind,
    id: string | null,
  ) {
    const promptId = ctx.callbackQuery.message!.message_id;
    if (action === 'list' || !id) {
      return this.editPrompt(promptId, await this.queueView());
    }
    if (action === 'open') {
      return this.editPrompt(promptId, await this.cardView(kind, id));
    }
    if (action === 'now' || action === 'ok') {
      let note: string;
      try {
        note =
          action === 'now'
            ? cap(await this.channel.publishNow(kind, id))
            : `Схвалено, ${await this.channel.approve(kind, id)}`;
      } catch (err) {
        return this.editPrompt(
          promptId,
          await this.cardView(kind, id, `Не вдалося: ${errorMessage(err)}`),
        );
      }
      return this.editPrompt(promptId, await this.queueView(note));
    }
    const steps: Record<string, Step> = {
      time: 'time',
      btn: 'button',
      text: 'text',
      title: 'title',
      cat: 'category',
      del: 'delete',
    };
    if (!steps[action]) return;
    const s: Session = {
      userId: ctx.from.id,
      promptId,
      step: steps[action],
      at: Date.now(),
      target: { kind, id },
    };
    this.sessions.set(s.userId, s);
    await this.editPrompt(promptId, await this.view(s));
  }

  /** Buttons of someone's own dialog (pd:…). */
  private async onDialog(ctx: ButtonContext, action: string, arg?: string) {
    const s = this.sessions.get(ctx.from.id);
    if (!s || s.promptId !== ctx.callbackQuery.message?.message_id) {
      await ctx.answerCallbackQuery({
        text: 'Ці кнопки — для того, хто почав діалог, або діалог уже завершено.',
        show_alert: true,
      });
      return;
    }
    s.at = Date.now();
    await ctx.answerCallbackQuery().catch(() => {});
    const d = s.draft;
    switch (action) {
      case 'cancel':
        this.sessions.delete(s.userId);
        return s.target
          ? this.closeToCard(s)
          : this.editPrompt(s.promptId, { text: 'Скасовано.', rows: [] });
      case 'back':
        if (s.step === 'event' || s.step === 'link') s.step = 'button';
        else if (s.target) return this.closeToCard(s);
        else s.step = 'when';
        break;
      case 'now':
        if (d) d.publishAt = undefined;
        s.step = 'button';
        break;
      case 'later':
        s.step = 'time';
        break;
      case 'cat': {
        const category = (arg === 'none' ? null : arg) as NewsCategory | null;
        if (s.target) return this.apply(s, { category });
        if (d) d.category = category;
        s.step = 'when';
        break;
      }
      case 'btn':
        if (arg === 'event' || arg === 'link') {
          s.step = arg;
          break;
        }
        return this.chooseButton(s, null, 'без кнопки');
      case 'ev': {
        const eventId = fromShortId(arg ?? '');
        const event =
          eventId &&
          (await this.prisma.event.findUnique({
            where: { id: eventId },
            select: { id: true, name: true },
          }));
        if (!event) break;
        return this.chooseButton(
          s,
          { eventId: event.id },
          `реєстрація на «${event.name}»`,
        );
      }
      case 'ok':
        if (s.step === 'delete' && s.target) {
          this.sessions.delete(s.userId);
          await this.channel.remove(s.target.kind, s.target.id);
          return this.editPrompt(
            s.promptId,
            await this.queueView('Видалено з черги.'),
          );
        }
        if (s.step === 'confirm') return this.finish(ctx, s);
        break;
    }
    await this.editPrompt(s.promptId, await this.view(s));
  }

  private async chooseButton(
    s: Session,
    choice: ButtonChoice | null,
    label: string,
  ) {
    if (s.target) return this.apply(s, { button: choice });
    s.draft!.button = choice;
    s.draft!.buttonLabel = label;
    s.step = 'confirm';
    await this.editPrompt(s.promptId, await this.view(s));
  }

  /** Saves a change to a queued post and shows its card again. */
  private async apply(
    s: Session,
    changes: Parameters<ChannelService['change']>[2],
  ) {
    await this.channel.change(s.target!.kind, s.target!.id, changes);
    this.sessions.delete(s.userId);
    await this.closeToCard(s, 'Збережено.');
  }

  private async closeToCard(s: Session, note?: string) {
    this.sessions.delete(s.userId);
    await this.editPrompt(
      s.promptId,
      await this.cardView(s.target!.kind, s.target!.id, note),
    );
  }

  // ---- Typed answers ------------------------------------------------------------

  private async onMessage(ctx: Context, next: NextFunction) {
    const msg = ctx.message;
    const s = ctx.from ? this.sessions.get(ctx.from.id) : undefined;
    const text = msg?.text ?? msg?.caption;
    if (
      !msg ||
      !s ||
      !text ||
      text.startsWith('/') ||
      !['title', 'time', 'link', 'text'].includes(s.step) ||
      !this.here(ctx)
    ) {
      return next();
    }
    if (Date.now() - s.at > SESSION_TTL_MS) {
      this.sessions.delete(s.userId);
      return next();
    }
    await this.inChat(ctx, next, () => this.onInput(ctx, s, msg, text));
  }

  private async onInput(ctx: Context, s: Session, msg: Message, text: string) {
    const answer = (reply: string) =>
      ctx.reply(reply, { reply_parameters: { message_id: msg.message_id } });
    const d = s.draft;
    s.at = Date.now();
    switch (s.step) {
      case 'title': {
        const value = text.trim().replace(/\s+/g, ' ');
        if (value.length > 50) {
          return answer(
            `Заголовок задовгий: ${value.length} з 50 можливих символів. Скороти, будь ласка.`,
          );
        }
        if (s.target) return this.apply(s, { title: value });
        d!.title = value;
        s.step = 'category';
        break;
      }
      case 'time': {
        const at = parseKyivDateTime(text, new Date());
        if (typeof at === 'string') return answer(at);
        if (s.target) return this.apply(s, { publishAt: at });
        d!.publishAt = at;
        s.step = 'button';
        break;
      }
      case 'link': {
        const button = parseButtonLine(text);
        if (!button) {
          return answer(
            'Не бачу посилання. Приклад: Анкета https://forms.gle/abc',
          );
        }
        return this.chooseButton(s, button, `«${button.text}» → ${button.url}`);
      }
      case 'text':
        return this.apply(s, {
          text: entitiesToHtml(
            text,
            msg.entities ?? msg.caption_entities,
            s.target!.kind,
          ),
        });
    }
    await this.editPrompt(s.promptId, await this.view(s));
  }
}
