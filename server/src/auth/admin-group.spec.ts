import type { ConfigService } from '@nestjs/config';
import { inAdminGroup } from './admin-group';

const config = (groupId?: string) =>
  ({ get: () => groupId }) as unknown as ConfigService;

describe('inAdminGroup', () => {
  it('trusts the tag when no admin group is configured', async () => {
    const bot = { isUserInChat: jest.fn() };
    expect(await inAdminGroup(config(), bot, 42n)).toBe(true);
    expect(bot.isUserInChat).not.toHaveBeenCalled();
  });

  it('asks Telegram about this account id otherwise', async () => {
    const bot = { isUserInChat: jest.fn().mockResolvedValue(false) };
    expect(await inAdminGroup(config('-100123'), bot, 42n)).toBe(false);
    expect(bot.isUserInChat).toHaveBeenCalledWith('-100123', 42);
  });
});
