import { ConfigService } from '@nestjs/config';
import { UserBotService } from './user-bot.service';

const serviceWith = (env: Record<string, string>) =>
  new UserBotService(
    { get: (key: string) => env[key] } as unknown as ConfigService,
    {} as never,
  );

describe('UserBotService.getMiniAppUrl', () => {
  it('prefers USER_MINI_APP_URL', () => {
    const service = serviceWith({
      USER_MINI_APP_URL: 'https://fice-sc.kpi.ua/app/',
      MINI_APP_URL: 'https://fice-sc.kpi.ua/admin',
      PUBLIC_WEB_URL: 'https://fice-sc.kpi.ua',
    });
    expect(service.getMiniAppUrl()).toBe('https://fice-sc.kpi.ua/app');
  });

  it('falls back to PUBLIC_WEB_URL, never to the admin MINI_APP_URL', () => {
    const service = serviceWith({
      MINI_APP_URL: 'https://fice-sc.kpi.ua/admin',
      PUBLIC_WEB_URL: 'https://fice-sc.kpi.ua/',
    });
    expect(service.getMiniAppUrl()).toBe('https://fice-sc.kpi.ua/app');
  });

  it('ignores MINI_APP_URL when nothing else is set', () => {
    const service = serviceWith({
      MINI_APP_URL: 'https://fice-sc.kpi.ua/admin',
    });
    expect(service.getMiniAppUrl()).not.toContain('/admin');
  });
});
