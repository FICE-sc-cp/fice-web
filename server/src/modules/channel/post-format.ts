import type { Message, MessageEntity } from 'grammy/types';
import { escapeHtml } from '../../common/html';
import { EVENT_TIME_ZONE, kyivWallTime } from '../event/event-timing';

export type MediaType = 'photo' | 'video' | 'animation';

export interface PostMedia {
  type: MediaType;
  fileId: string;
  size?: number;
}

/** Bots can download files up to 20 MB (Bot API getFile). */
export const BOT_DOWNLOAD_LIMIT = 20 * 1024 * 1024;
export const CAPTION_LIMIT = 1024;
export const TEXT_LIMIT = 4096;

type Flavor = 'channel' | 'site';

function tagsFor(
  e: MessageEntity,
  flavor: Flavor,
): [open: string, close: string] | null {
  const simple: Partial<Record<MessageEntity['type'], string>> = {
    bold: 'b',
    italic: 'i',
    underline: 'u',
    strikethrough: 's',
  };
  const tag = simple[e.type];
  if (tag) return [`<${tag}>`, `</${tag}>`];
  if (e.type === 'text_link') {
    if (flavor === 'site' && !/^https?:\/\//i.test(e.url)) return null;
    return [`<a href="${escapeHtml(e.url)}">`, '</a>'];
  }
  // The site renders only b/i/u/s/a; the rest stays plain text there.
  if (flavor === 'site') return null;
  switch (e.type) {
    case 'spoiler':
      return ['<tg-spoiler>', '</tg-spoiler>'];
    case 'code':
      return ['<code>', '</code>'];
    case 'pre':
      return e.language
        ? [
            `<pre><code class="language-${escapeHtml(e.language)}">`,
            '</code></pre>',
          ]
        : ['<pre>', '</pre>'];
    case 'blockquote':
      return ['<blockquote>', '</blockquote>'];
    case 'expandable_blockquote':
      return ['<blockquote expandable>', '</blockquote>'];
    case 'text_mention':
      return [`<a href="tg://user?id=${e.user.id}">`, '</a>'];
    default:
      // Custom (premium) emoji are left out: bots may only send them with a
      // Fragment username, so the plain emoji they fall back to is kept.
      return null;
  }
}

/**
 * Telegram message text + entities → HTML for parse_mode=HTML (channel) or for
 * the site's rich text, which knows only b/i/u/s/a and can't carry a tag across
 * a line break (every line is a paragraph there).
 */
export function entitiesToHtml(
  text: string,
  entities: MessageEntity[] = [],
  flavor: Flavor,
): string {
  const tags = entities
    .map((e) => ({ e, tags: tagsFor(e, flavor) }))
    .filter((t) => t.tags)
    .sort((a, b) => a.e.offset - b.e.offset || b.e.length - a.e.length);
  const open: { end: number; open: string; close: string }[] = [];
  let next = 0;
  let out = '';
  // Offsets are UTF-16 code units, which is how JS indexes strings.
  for (let i = 0; i <= text.length; i++) {
    while (open.length && open[open.length - 1].end <= i) {
      out += open.pop()!.close;
    }
    while (next < tags.length && tags[next].e.offset <= i) {
      const { e, tags: t } = tags[next++];
      out += t![0];
      open.push({ end: e.offset + e.length, open: t![0], close: t![1] });
    }
    if (i === text.length) break;
    const ch = text[i];
    if (ch === '\n' && flavor === 'site' && open.length) {
      const closes = [...open].reverse().map((t) => t.close);
      out += `${closes.join('')}\n${open.map((t) => t.open).join('')}`;
    } else {
      out +=
        ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch;
    }
  }
  while (open.length) out += open.pop()!.close;
  return out;
}

/** Text without tags and entities, as Telegram counts it against its limits. */
export function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

/** Why this text can't go out in one channel message, or null. */
export function lengthProblem(html: string, withMedia: boolean): string | null {
  const length = plainText(html).length;
  if (withMedia && length > CAPTION_LIMIT) {
    return `Підпис до фото чи відео задовгий: ${length} з ${CAPTION_LIMIT} можливих символів. Скороти текст або прибери медіа.`;
  }
  if (length > TEXT_LIMIT) {
    return `Текст задовгий: ${length} з ${TEXT_LIMIT} можливих символів.`;
  }
  return null;
}

/** The one photo, video or GIF of a message (largest photo size). */
export function mediaOf(msg: Message): PostMedia | undefined {
  if (msg.photo?.length) {
    const p = msg.photo[msg.photo.length - 1];
    return { type: 'photo', fileId: p.file_id, size: p.file_size };
  }
  // A GIF also carries `document`, so check it before video.
  if (msg.animation) {
    return {
      type: 'animation',
      fileId: msg.animation.file_id,
      size: msg.animation.file_size,
    };
  }
  if (msg.video) {
    return {
      type: 'video',
      fileId: msg.video.file_id,
      size: msg.video.file_size,
    };
  }
  return undefined;
}

/** Why a message can't be published as a post, or null when it can. */
export function sourceProblem(msg: Message): string | null {
  if (msg.media_group_id) {
    return 'Альбоми (кілька фото чи відео в одному пості) бот не публікує. Залиш одне фото, відео чи GIF.';
  }
  const other =
    msg.document && !msg.animation
      ? 'файл'
      : msg.sticker
        ? 'стікер'
        : msg.voice || msg.audio
          ? 'аудіо'
          : msg.video_note
            ? 'відеокружечок'
            : msg.poll
              ? 'опитування'
              : null;
  if (other) {
    return `Такий пост (${other}) бот не опублікує: потрібен текст і щонайбільше одне фото, відео чи GIF.`;
  }
  if (!msg.text && !msg.caption && !mediaOf(msg)) {
    return 'У цьому повідомленні немає ні тексту, ні фото чи відео.';
  }
  return null;
}

const kyivFormat = new Intl.DateTimeFormat('uk-UA', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: EVENT_TIME_ZONE,
});

/** "17 жовтня о 18:30" in Kyiv time (some ICU builds put a comma instead). */
export function formatKyiv(at: Date): string {
  return kyivFormat.format(at).replace(/,?\s+(?:о\s+)?(\d{2}:\d{2})$/, ' о $1');
}

const kyivDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: EVENT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * "17.10 18:30", "17.10.2026 18:30" or just "18:30" (today), Kyiv time.
 * Returns an error text instead when it can't be read or is not in the future.
 */
export function parseKyivDateTime(input: string, now: Date): Date | string {
  const m =
    /^(?:(\d{1,2})[./](\d{1,2})(?:[./](\d{2}|\d{4}))?(?:\s+|\s*,\s*)(?:о\s+)?)?(\d{1,2}):(\d{2})$/i.exec(
      input.trim(),
    );
  if (!m) return 'Не зрозумів дату. Напиши, наприклад: 17.10 18:30';
  const [cy, cm, cd] = kyivDate.format(now).split('-').map(Number);
  const day = m[1] ? Number(m[1]) : cd;
  const month = m[2] ? Number(m[2]) : cm;
  const year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : cy;
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const at = kyivWallTime(year, month, day, hour, minute);
  const [y2, m2, d2] = kyivDate.format(at).split('-').map(Number);
  if (hour > 23 || minute > 59 || y2 !== year || m2 !== month || d2 !== day) {
    return 'Такої дати чи часу не буває. Приклад: 17.10 18:30';
  }
  if (at.getTime() <= now.getTime()) {
    return `Цей час уже минув. Якщо мова про наступний рік, допиши його: ${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year + 1} ${m[4]}:${m[5]}`;
  }
  return at;
}

/** "Анкета https://forms.gle/x" → button; label defaults to "Перейти". */
export function parseButtonLine(
  input: string,
): { text: string; url: string } | null {
  const words = input.trim().split(/\s+/);
  const last = words.pop() ?? '';
  const raw = /^https?:\/\//i.test(last) ? last : `https://${last}`;
  try {
    const url = new URL(raw);
    if (!url.hostname.includes('.')) return null;
    const text = words
      .join(' ')
      .replace(/[\s:—–-]+$/, '')
      .slice(0, 64);
    return { text: text || 'Перейти', url: url.toString() };
  } catch {
    return null;
  }
}

/** UUID ↔ 22-char base64url, so two ids fit Telegram's 64-byte callback data. */
export function shortId(uuid: string): string {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex').toString('base64url');
}

export function fromShortId(short: string): string | null {
  const hex = Buffer.from(short, 'base64url').toString('hex');
  if (hex.length !== 32) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** First chars of a post's text, without markup. */
export function excerpt(html: string, max = 60): string {
  const text = plainText(html).replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** Media kind of an uploaded file by its extension. */
export function mediaTypeOf(path: string): MediaType {
  if (/\.gif(\?|$)/i.test(path)) return 'animation';
  if (/\.(mp4|webm|mov)(\?|$)/i.test(path)) return 'video';
  return 'photo';
}
