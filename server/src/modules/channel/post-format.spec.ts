import type { Message, MessageEntity } from 'grammy/types';
import {
  entitiesToHtml,
  formatKyiv,
  fromShortId,
  lengthProblem,
  parseButtonLine,
  parseKyivDateTime,
  shortId,
  sourceProblem,
} from './post-format';

const e = (
  type: string,
  offset: number,
  length: number,
  extra = {},
): MessageEntity => ({ type, offset, length, ...extra }) as MessageEntity;

describe('entitiesToHtml', () => {
  it('nests tags, escapes text and keeps links for the channel', () => {
    const text = 'Q&A <live> тут';
    const html = entitiesToHtml(
      text,
      [
        e('bold', 0, 10),
        e('italic', 4, 6),
        e('text_link', 11, 3, { url: 'https://x.ua/?a=1&b="2"' }),
      ],
      'channel',
    );
    expect(html).toBe(
      '<b>Q&amp;A <i>&lt;live&gt;</i></b> <a href="https://x.ua/?a=1&amp;b=&quot;2&quot;">тут</a>',
    );
  });

  it('keeps Telegram-only formatting for the channel but drops premium emoji', () => {
    const html = entitiesToHtml(
      '😀 секрет',
      [e('custom_emoji', 0, 2, { custom_emoji_id: '1' }), e('spoiler', 3, 6)],
      'channel',
    );
    expect(html).toBe('😀 <tg-spoiler>секрет</tg-spoiler>');
  });

  it('splits tags at line breaks for the site and keeps only what it renders', () => {
    const html = entitiesToHtml(
      'раз\nдва секрет',
      [
        e('bold', 0, 7),
        e('spoiler', 8, 6),
        e('text_link', 4, 3, { url: 'tg://x' }),
      ],
      'site',
    );
    expect(html).toBe('<b>раз</b>\n<b>два</b> секрет');
  });

  it('counts emoji in UTF-16 units like Telegram', () => {
    expect(entitiesToHtml('👍 так', [e('bold', 3, 3)], 'channel')).toBe(
      '👍 <b>так</b>',
    );
  });
});

describe('lengthProblem', () => {
  it('limits captions by visible text, not markup', () => {
    const caption = `<b>${'я'.repeat(1024)}</b>`;
    expect(lengthProblem(caption, true)).toBeNull();
    expect(lengthProblem(`${caption}&amp;`, true)).toMatch(/1025/);
    expect(lengthProblem(`${caption}&amp;`, false)).toBeNull();
  });
});

describe('parseKyivDateTime', () => {
  // 16 Oct 2026, 12:00 in Kyiv (UTC+3).
  const now = new Date('2026-10-16T09:00:00Z');

  it('reads a date and time in Kyiv time', () => {
    expect(parseKyivDateTime('17.10 18:30', now)).toEqual(
      new Date('2026-10-17T15:30:00Z'),
    );
    expect(parseKyivDateTime('05.01.2027 о 10:00', now)).toEqual(
      new Date('2027-01-05T08:00:00Z'),
    );
  });

  it('takes a bare time as today', () => {
    expect(parseKyivDateTime('18:05', now)).toEqual(
      new Date('2026-10-16T15:05:00Z'),
    );
  });

  it('rejects the past, impossible dates and other text', () => {
    expect(parseKyivDateTime('16.10 11:00', now)).toMatch(
      /минув.*16\.10\.2027/,
    );
    expect(parseKyivDateTime('31.02 10:00', now)).toMatch(/не буває/);
    expect(parseKyivDateTime('17.10 25:00', now)).toMatch(/не буває/);
    expect(parseKyivDateTime('завтра', now)).toMatch(/Не зрозумів/);
    expect(parseKyivDateTime('17.10', now)).toMatch(/Не зрозумів/);
  });

  it('formats back the same way', () => {
    expect(formatKyiv(new Date('2026-10-17T15:30:00Z'))).toBe(
      '17 жовтня о 18:30',
    );
  });
});

describe('parseButtonLine', () => {
  it('splits the label from the link', () => {
    expect(parseButtonLine('Анкета: https://forms.gle/abc')).toEqual({
      text: 'Анкета',
      url: 'https://forms.gle/abc',
    });
    expect(parseButtonLine('t.me/fice_event_bot')).toEqual({
      text: 'Перейти',
      url: 'https://t.me/fice_event_bot',
    });
    expect(parseButtonLine('Анкета')).toBeNull();
  });
});

describe('shortId', () => {
  it('round-trips a uuid in 22 chars', () => {
    const id = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';
    expect(shortId(id)).toHaveLength(22);
    expect(fromShortId(shortId(id))).toBe(id);
    expect(fromShortId('nope')).toBeNull();
  });
});

describe('sourceProblem', () => {
  const msg = (m: object) => ({ message_id: 1, date: 0, ...m }) as Message;

  it('accepts text or one photo, video or GIF', () => {
    expect(sourceProblem(msg({ text: 'пост' }))).toBeNull();
    expect(
      sourceProblem(msg({ photo: [{ file_id: 'p' }], caption: 'x' })),
    ).toBeNull();
    expect(
      sourceProblem(
        msg({ animation: { file_id: 'a' }, document: { file_id: 'a' } }),
      ),
    ).toBeNull();
  });

  it('rejects albums, files and empty messages', () => {
    expect(
      sourceProblem(msg({ photo: [{ file_id: 'p' }], media_group_id: 'g' })),
    ).toMatch(/Альбоми/);
    expect(sourceProblem(msg({ document: { file_id: 'd' } }))).toMatch(/файл/);
    expect(sourceProblem(msg({}))).toMatch(/немає/);
  });
});
