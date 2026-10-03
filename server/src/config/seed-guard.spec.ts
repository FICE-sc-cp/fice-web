import { destructiveSeedRefusal } from './seed-guard';

describe('destructiveSeedRefusal', () => {
  it('refuses without ALLOW_DESTRUCTIVE_SEED=1', () => {
    expect(destructiveSeedRefusal({})).toMatch(/ALLOW_DESTRUCTIVE_SEED=1/);
    expect(
      destructiveSeedRefusal({ ALLOW_DESTRUCTIVE_SEED: 'true' }),
    ).not.toBeNull();
  });

  it('refuses in production even when allowed', () => {
    expect(
      destructiveSeedRefusal({
        APP_ENV: 'production',
        ALLOW_DESTRUCTIVE_SEED: '1',
      }),
    ).toMatch(/APP_ENV=production/);
  });

  it('allows an explicitly confirmed dev run', () => {
    expect(destructiveSeedRefusal({ ALLOW_DESTRUCTIVE_SEED: '1' })).toBeNull();
    expect(
      destructiveSeedRefusal({
        APP_ENV: 'development',
        ALLOW_DESTRUCTIVE_SEED: '1',
      }),
    ).toBeNull();
  });
});
