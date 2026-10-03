import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AdminAccessService } from './admin-access.service';

jest.mock('@tma.js/init-data-node', () => ({
  validate: jest.fn((initData: string) => {
    if (initData === 'invalid') throw new Error('bad signature');
  }),
}));

const initDataFor = (id: number) =>
  `user=${encodeURIComponent(JSON.stringify({ id }))}&hash=x`;

describe('AdminAccessService', () => {
  let env: Record<string, string>;
  let isUserInChat: jest.Mock;
  let service: AdminAccessService;

  beforeEach(() => {
    env = { TELEGRAM_BOT_TOKEN: '1:abc', ADMIN_GROUP_CHAT_ID: '-100' };
    isUserInChat = jest.fn((_chat: string, userId: number) =>
      Promise.resolve(userId === 1),
    );
    service = new AdminAccessService(
      { get: (key: string) => env[key] } as never,
      { isUserInChat } as never,
    );
  });

  it('recognises members of the admin group', async () => {
    expect(await service.isAdmin(initDataFor(1))).toBe(true);
    expect(await service.isAdmin(initDataFor(2))).toBe(false);
    expect(await service.isAdmin('invalid')).toBe(false);
    expect(await service.isAdmin(undefined)).toBe(false);
  });

  it('lets only admins list drafts', async () => {
    expect(await service.draftsAllowed(undefined, undefined)).toBe(false);
    expect(await service.draftsAllowed(false, initDataFor(2))).toBe(false);
    expect(await service.draftsAllowed(true, initDataFor(1))).toBe(true);
    await expect(
      service.draftsAllowed(true, initDataFor(2)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.draftsAllowed(true, undefined)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('does not hide a Telegram outage behind "not an admin"', async () => {
    isUserInChat.mockRejectedValue(new ServiceUnavailableException());
    await expect(service.isAdmin(initDataFor(1))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('treats everyone as admin only with AUTH_DISABLED', async () => {
    env.AUTH_DISABLED = 'true';
    expect(await service.isAdmin(undefined)).toBe(true);
  });
});
