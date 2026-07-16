import { ServiceUnavailableException } from '@nestjs/common';
import { ChannelService } from './channel.service';

type Cfg = Record<string, string | undefined>;

function makeService(cfg: Cfg, event: { id: string; photoUrl: string | null } | null) {
  const postToChannel = jest.fn().mockResolvedValue({ messageId: 42 });
  const prisma = {
    event: { findUnique: jest.fn().mockResolvedValue(event) },
  };
  const bot = { postToChannel };
  const config = { get: (k: string) => cfg[k] };
  const service = new ChannelService(
    prisma as never,
    bot as never,
    config as never,
  );
  return { service, postToChannel };
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
    const { service, postToChannel } = makeService({ PUBLIC_WEB_URL: WEB }, null);

    await service.post({ text: 'hi', buttonUrl: 'https://t.me/foo' });

    expect(postToChannel).toHaveBeenCalledWith({
      text: 'hi',
      photoUrl: undefined,
      button: { text: 'Перейти', url: 'https://t.me/foo' },
    });
  });

  it('posts without a button when neither event nor buttonUrl is given', async () => {
    const { service, postToChannel } = makeService({ PUBLIC_WEB_URL: WEB }, null);

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
});
