import { ServiceUnavailableException } from '@nestjs/common';
import { GrammyError } from 'grammy';
import { BotService } from './bot.service';

const GROUP = '-1001234567890';

const grammyError = (code: number, description: string) =>
  new GrammyError(
    'Call to getChatMember failed!',
    { ok: false, error_code: code, description },
    'getChatMember',
    {},
  );

describe('BotService.isUserInChat', () => {
  let service: BotService;
  let getChatMember: jest.Mock;

  beforeEach(() => {
    const config = {
      get: (key: string) =>
        key === 'TELEGRAM_BOT_TOKEN' ? '123:abc' : undefined,
    };
    service = new BotService(config as never, {} as never, {} as never);
    getChatMember = jest.fn();
    (service as any).bot.api.getChatMember = getChatMember;
  });

  it('caches a positive answer instead of asking Telegram on every request', async () => {
    getChatMember.mockResolvedValue({ status: 'member' });

    expect(await service.isUserInChat(GROUP, 1)).toBe(true);
    expect(await service.isUserInChat(GROUP, 1)).toBe(true);
    expect(getChatMember).toHaveBeenCalledTimes(1);
  });

  it('does not cache a negative answer', async () => {
    getChatMember.mockResolvedValue({ status: 'left' });

    expect(await service.isUserInChat(GROUP, 2)).toBe(false);
    expect(await service.isUserInChat(GROUP, 2)).toBe(false);
    expect(getChatMember).toHaveBeenCalledTimes(2);
  });

  it('accepts restricted members who are still in the chat', async () => {
    getChatMember.mockResolvedValueOnce({
      status: 'restricted',
      is_member: true,
    });
    expect(await service.isUserInChat(GROUP, 3)).toBe(true);

    getChatMember.mockResolvedValueOnce({
      status: 'restricted',
      is_member: false,
    });
    expect(await service.isUserInChat(GROUP, 4)).toBe(false);
  });

  it('treats an unknown user as not a member', async () => {
    getChatMember.mockRejectedValue(
      grammyError(400, 'Bad Request: user not found'),
    );

    expect(await service.isUserInChat(GROUP, 5)).toBe(false);
  });

  it('answers 503 when Telegram itself fails, instead of a false 403', async () => {
    getChatMember.mockRejectedValue(new Error('network timeout'));

    await expect(service.isUserInChat(GROUP, 6)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
