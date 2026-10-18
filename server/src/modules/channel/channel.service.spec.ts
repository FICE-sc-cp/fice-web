import { ServiceUnavailableException } from '@nestjs/common';
import { ChannelService } from './channel.service';

type Cfg = Record<string, string | undefined>;

function makeService(
  cfg: Cfg,
  event: { id: string; photoUrl: string | null } | null,
) {
  const postToChannel = jest.fn().mockResolvedValue({ messageId: 42 });
  const editChannelPost = jest.fn().mockResolvedValue(undefined);
  type Row = Record<string, unknown> & { id: string; status: string };
  const rows = new Map<string, Row>();
  const row = (id: string) => rows.get(id)!;
  const prisma = {
    event: { findUnique: jest.fn().mockResolvedValue(event) },
    channelPost: {
      create: jest.fn(({ data }: { data: object }) => {
        const r = { id: `p${rows.size + 1}`, status: 'SCHEDULED', ...data };
        rows.set(r.id, r);
        return Promise.resolve(r);
      }),
      updateMany: jest.fn(
        ({ where, data }: { where: { id: string }; data: object }) => {
          const r = rows.get(where.id);
          if (!r || r.status === 'PUBLISHED')
            return Promise.resolve({ count: 0 });
          Object.assign(r, data);
          return Promise.resolve({ count: 1 });
        },
      ),
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(rows.get(where.id) ?? null),
      findUniqueOrThrow: ({ where }: { where: { id: string } }) =>
        Promise.resolve(row(where.id)),
      update: ({ where, data }: { where: { id: string }; data: object }) =>
        Promise.resolve(Object.assign(row(where.id), data)),
      delete: ({ where }: { where: { id: string } }) =>
        Promise.resolve(rows.delete(where.id)),
    },
  };
  const bot = { postToChannel, editChannelPost };
  const userBot = { getUsername: () => cfg['USER_BOT_USERNAME'] };
  const config = { get: (k: string) => cfg[k] };
  const service = new ChannelService(
    prisma as never,
    bot as never,
    userBot as never,
    config as never,
  );
  return { service, postToChannel, editChannelPost, rows };
}

describe('ChannelService', () => {
  const WEB = 'https://fice.example';

  it('builds the register button URL from PUBLIC_WEB_URL + event id', async () => {
    const { service, postToChannel } = makeService(
      { PUBLIC_WEB_URL: WEB },
      { id: 'evt-1', photoUrl: '/uploads/cover.jpg' },
    );

    await service.post({ text: 'Прийди на захід', eventId: 'evt-1' });

    expect(postToChannel).toHaveBeenCalledWith({
      text: 'Прийди на захід',
      photoUrl: '/uploads/cover.jpg', // falls back to the event cover
      button: {
        text: 'Зареєструватися',
        url: `${WEB}/events/evt-1#register`,
      },
    });
  });

  it('trims a trailing slash on PUBLIC_WEB_URL and honors a custom button label', async () => {
    const { service, postToChannel } = makeService(
      { PUBLIC_WEB_URL: `${WEB}/` },
      { id: 'evt-2', photoUrl: null },
    );

    await service.post({
      text: 'x',
      eventId: 'evt-2',
      imageUrl: '/uploads/override.png',
      buttonText: 'Реєстрація',
    });

    expect(postToChannel).toHaveBeenCalledWith({
      text: 'x',
      photoUrl: '/uploads/override.png', // explicit image wins over event cover
      button: { text: 'Реєстрація', url: `${WEB}/events/evt-2#register` },
    });
  });

  it('uses a manual buttonUrl for free-text posts (no event)', async () => {
    const { service, postToChannel } = makeService(
      { PUBLIC_WEB_URL: WEB },
      null,
    );

    await service.post({ text: 'hi', buttonUrl: 'https://t.me/foo' });

    expect(postToChannel).toHaveBeenCalledWith({
      text: 'hi',
      photoUrl: undefined,
      button: { text: 'Перейти', url: 'https://t.me/foo' },
    });
  });

  it('posts without a button when neither event nor buttonUrl is given', async () => {
    const { service, postToChannel } = makeService(
      { PUBLIC_WEB_URL: WEB },
      null,
    );

    await service.post({ text: 'plain' });

    expect(postToChannel).toHaveBeenCalledWith({
      text: 'plain',
      photoUrl: undefined,
      button: undefined,
    });
  });

  it('fails when an event post needs a link but PUBLIC_WEB_URL is unset', async () => {
    const { service } = makeService({}, { id: 'evt-3', photoUrl: null });

    await expect(service.post({ text: 'x', eventId: 'evt-3' })).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('schedules a post for later without sending it', async () => {
    const { service, postToChannel, rows } = makeService({}, null);
    const publishAt = new Date(Date.now() + 60 * 60_000);

    const res = await service.post({ text: 'later', publishAt });

    expect(res).toEqual({ ok: true, id: 'p1', scheduled: true });
    expect(postToChannel).not.toHaveBeenCalled();
    expect(rows.get('p1')).toMatchObject({ status: 'SCHEDULED', publishAt });
  });

  it('sends a post once even when the scheduler and "now" race', async () => {
    const { service, postToChannel } = makeService({}, null);
    await service.post({
      text: 'once',
      publishAt: new Date(Date.now() + 60_000),
    });

    const results = await Promise.all([
      service.publish('p1'),
      service.publish('p1'),
    ]);

    expect(results.sort()).toEqual([42, null]);
    expect(postToChannel).toHaveBeenCalledTimes(1);
  });

  it('leaves nothing in the queue when an immediate post is refused', async () => {
    const { service, postToChannel, rows } = makeService({}, null);
    postToChannel.mockRejectedValueOnce(new Error('Bad Request'));

    await expect(service.post({ text: 'now' })).rejects.toThrow('Bad Request');
    expect(rows.size).toBe(0);
  });

  it('refuses a caption Telegram would cut', async () => {
    const { service, postToChannel } = makeService({}, null);

    await expect(
      service.post({ text: 'я'.repeat(1025), imageUrl: '/uploads/a.jpg' }),
    ).rejects.toThrow(/1024/);
    expect(postToChannel).not.toHaveBeenCalled();
  });

  it('puts a new text and button of a published post into the channel', async () => {
    const { service, editChannelPost, rows } = makeService({}, null);
    await service.post({ text: 'old', imageUrl: '/uploads/a.jpg' });

    await service.change('channel', 'p1', {
      text: 'new',
      button: { text: 'Анкета', url: 'https://forms.gle/x' },
    });

    expect(editChannelPost).toHaveBeenCalledWith(42, {
      text: 'new',
      photoUrl: '/uploads/a.jpg',
      media: undefined,
      button: { text: 'Анкета', url: 'https://forms.gle/x' },
    });
    expect(rows.get('p1')).toMatchObject({
      text: 'new',
      buttonUrl: 'https://forms.gle/x',
    });
  });

  it('keeps a published post as it was when Telegram refuses the edit', async () => {
    const { service, editChannelPost, rows } = makeService({}, null);
    await service.post({ text: 'old' });
    editChannelPost.mockRejectedValueOnce(new Error('Bad Request'));

    await expect(
      service.change('channel', 'p1', { text: 'new' }),
    ).rejects.toThrow('Bad Request');
    await expect(
      service.updatePost('p1', { imageUrl: '/uploads/b.jpg' }),
    ).rejects.toThrow(/текст і кнопку/);
    expect(rows.get('p1')).toMatchObject({ text: 'old', imageUrl: null });
  });
});
