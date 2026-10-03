import { productionEnvErrors, validateEnv } from './env.validation';

const PROD = {
  APP_ENV: 'production',
  DATABASE_URL: 'postgresql://postgres:secret@postgres:5432/fice',
  TELEGRAM_BOT_TOKEN: '111:admin',
  USER_BOT_TOKEN: '222:user',
  USER_BOT_USERNAME: 'fice_student_bot',
  ADMIN_GROUP_CHAT_ID: '-1001234567890',
  MINI_APP_URL: 'https://fice-sc.kpi.ua/admin',
  USER_MINI_APP_URL: 'https://fice-sc.kpi.ua/app',
  PUBLIC_WEB_URL: 'https://fice-sc.kpi.ua',
  CORS_ORIGIN: 'https://fice-sc.kpi.ua',
};

describe('validateEnv', () => {
  it('accepts a complete production env', () => {
    expect(productionEnvErrors(PROD)).toEqual([]);
    expect(validateEnv(PROD)).toBe(PROD);
  });

  it('does not check anything outside production', () => {
    const dev = { AUTH_DISABLED: 'true' };
    expect(validateEnv(dev)).toBe(dev);
    expect(validateEnv({ ...dev, APP_ENV: 'development' })).toBeTruthy();
  });

  it.each([
    'DATABASE_URL',
    'TELEGRAM_BOT_TOKEN',
    'USER_BOT_TOKEN',
    'USER_BOT_USERNAME',
    'ADMIN_GROUP_CHAT_ID',
    'MINI_APP_URL',
    'USER_MINI_APP_URL',
    'PUBLIC_WEB_URL',
    'CORS_ORIGIN',
  ])('refuses to start without %s', (key) => {
    expect(() => validateEnv({ ...PROD, [key]: '' })).toThrow(
      `${key} is required`,
    );
    const rest: Record<string, string> = { ...PROD };
    delete rest[key];
    expect(() => validateEnv(rest)).toThrow(`${key} is required`);
  });

  it('refuses AUTH_DISABLED=true', () => {
    expect(() => validateEnv({ ...PROD, AUTH_DISABLED: 'true' })).toThrow(
      'AUTH_DISABLED',
    );
  });

  it('refuses the same token for both bots', () => {
    expect(() =>
      validateEnv({ ...PROD, USER_BOT_TOKEN: PROD.TELEGRAM_BOT_TOKEN }),
    ).toThrow('must be different bots');
  });

  it('rejects malformed values', () => {
    const errors = productionEnvErrors({
      ...PROD,
      ADMIN_GROUP_CHAT_ID: '@admins',
      USER_BOT_USERNAME: '@fice_student_bot',
      USER_MINI_APP_URL: 'http://fice-sc.kpi.ua/app',
      CORS_ORIGIN: 'https://fice-sc.kpi.ua/',
    });
    expect(errors).toHaveLength(4);
  });
});
