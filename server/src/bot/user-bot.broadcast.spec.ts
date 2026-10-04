import { GrammyError, InputFile } from 'grammy';
import { UserBotService } from './user-bot.service';

const tooManyRequests = () =>
  new GrammyError(
    'Call to sendMessage failed!',
    {
      ok: false,
      error_code: 429,
      description: 'Too Many Requests: retry after 0',
      parameters: { retry_after: 0 },
    },
    'sendMessage',
    {},
  );

describe('UserBotService.sendBroadcast', () => {
  let service: UserBotService;
  let api: { sendMessage: jest.Mock; sendPhoto: jest.Mock };

  beforeEach(() => {
    const env: Record<string, string> = {
      TELEGRAM_BOT_TOKEN: '111:admin',
      USER_BOT_TOKEN: '222:user',
    };
    service = new UserBotService(
      { get: (key: string) => env[key] } as never,
      { botUser: { updateMany: jest.fn().mockResolvedValue({}) } } as never,
    );
    api = { sendMessage: jest.fn(), sendPhoto: jest.fn() };
    Object.assign((service as any).bot.api, api);
  });

  const recipients = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ chatId: BigInt(i + 1) }));

  it('waits and retries when Telegram answers 429', async () => {
    api.sendMessage
      .mockRejectedValueOnce(tooManyRequests())
      .mockResolvedValue({});

    const result = await service.sendBroadcast(recipients(2), { text: 'Hi' });

    expect(result).toEqual({ sent: 2, failed: 0 });
    expect(api.sendMessage).toHaveBeenCalledTimes(3);
  });

  it('uploads a photo once and reuses its file_id', async () => {
    api.sendPhoto.mockResolvedValue({
      photo: [{ file_id: 'small' }, { file_id: 'large' }],
    });

    await service.sendBroadcast(recipients(3), {
      text: 'Hi',
      imageUrl: '/uploads/0e352379-dbd8-407f-98a5-38d60ab53528.jpg',
    });

    expect(api.sendPhoto.mock.calls[0][1]).toBeInstanceOf(InputFile);
    expect(api.sendPhoto.mock.calls[1][1]).toBe('large');
    expect(api.sendPhoto.mock.calls[2][1]).toBe('large');
  });

  it('reports progress while sending', async () => {
    api.sendMessage.mockResolvedValue({});
    const progress = jest.fn().mockResolvedValue(undefined);

    await service.sendBroadcast(recipients(50), { text: 'Hi' }, progress);

    expect(progress).toHaveBeenCalledWith({ sent: 25, failed: 0 });
    expect(progress).toHaveBeenCalledWith({ sent: 50, failed: 0 });
  });
});
