import { FundraiserStatus, Prisma } from '@prisma/client';
import {
  BACKOFF_MAX_MS,
  BACKOFF_START_MS,
  JarSyncService,
  SYNC_EVERY_MS,
} from './jar-sync.service';
import { JarFetchResult } from './monobank-jar.client';

const WIDGET =
  'https://send.monobank.ua/widget.html?jar=3nzmmsWPvF88kT6FKrnpUwSaLkF2pwMK&sendId=6MJtUJ8B8d&type=qrp';
const FUNDRAISER = { id: 'f-1', name: 'Пікап', jarWidgetUrl: WIDGET };

const ok = (over: Partial<Record<string, unknown>> = {}): JarFetchResult => ({
  kind: 'ok',
  jar: {
    amountKopecks: 123456,
    goalKopecks: 5000000,
    closed: false,
    sendId: '6MJtUJ8B8d',
    ...over,
  },
});

describe('JarSyncService', () => {
  let service: JarSyncService;
  let prisma: any;
  let client: { fetch: jest.Mock };
  let bot: { notifyGroup: jest.Mock };

  const advance = (ms: number) => jest.setSystemTime(Date.now() + ms);
  const lastData = () => prisma.fundraiser.updateMany.mock.calls.at(-1)[0];

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-09-25T12:00:00Z') });
    prisma = {
      fundraiser: {
        findMany: jest.fn().mockResolvedValue([FUNDRAISER]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    client = { fetch: jest.fn() };
    bot = { notifyGroup: jest.fn().mockResolvedValue(undefined) };
    service = new JarSyncService(prisma, client as any, bot as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does nothing when no fundraiser is due', async () => {
    prisma.fundraiser.findMany.mockResolvedValue([]);
    await service.tick();
    expect(client.fetch).not.toHaveBeenCalled();
  });

  it('only asks for active, linked, healthy fundraisers', async () => {
    prisma.fundraiser.findMany.mockResolvedValue([]);
    await service.tick();
    const { where } = prisma.fundraiser.findMany.mock.calls[0][0];
    expect(where.status).toBe(FundraiserStatus.ACTIVE);
    expect(where.jarWidgetUrl).toEqual({ not: null });
    expect(where.jarSyncError).toBeNull();
  });

  it('writes balance, goal and public link from the jar', async () => {
    client.fetch.mockResolvedValue(ok());
    await service.tick();

    expect(client.fetch).toHaveBeenCalledWith(
      '3nzmmsWPvF88kT6FKrnpUwSaLkF2pwMK',
    );
    const { where, data } = lastData();
    expect(where).toEqual({
      id: 'f-1',
      jarWidgetUrl: WIDGET,
      status: FundraiserStatus.ACTIVE,
    });
    expect(data.currentAmount).toEqual(new Prisma.Decimal('1234.56'));
    expect(data.goalAmount).toEqual(new Prisma.Decimal('50000'));
    expect(data.jarUrl).toBe('https://send.monobank.ua/jar/6MJtUJ8B8d');
    expect(data.jarSyncError).toBeNull();
    expect(data.jarSyncedAt).toBeInstanceOf(Date);
    expect(data.jarHasGoal).toBe(true);
    expect(data.status).toBeUndefined();
    expect(bot.notifyGroup).not.toHaveBeenCalled();
  });

  it('accepts a lower balance after a withdrawal', async () => {
    client.fetch.mockResolvedValueOnce(ok({ amountKopecks: 900000 }));
    await service.tick();
    advance(SYNC_EVERY_MS);
    client.fetch.mockResolvedValueOnce(ok({ amountKopecks: 100 }));
    await service.tick();
    expect(lastData().data.currentAmount).toEqual(new Prisma.Decimal('1'));
  });

  it('follows a changed goal and keeps the admin goal when the jar has none', async () => {
    client.fetch.mockResolvedValueOnce(ok({ goalKopecks: 7500000 }));
    await service.tick();
    expect(lastData().data.goalAmount).toEqual(new Prisma.Decimal('75000'));

    advance(SYNC_EVERY_MS);
    client.fetch.mockResolvedValueOnce(ok({ goalKopecks: 0 }));
    await service.tick();
    expect(lastData().data).not.toHaveProperty('goalAmount');
    expect(lastData().data.jarHasGoal).toBe(false);
  });

  it('always asks Monobank for fresh numbers', async () => {
    client.fetch.mockResolvedValue(ok());
    await service.tick();
    expect(client.fetch).toHaveBeenCalledWith(
      '3nzmmsWPvF88kT6FKrnpUwSaLkF2pwMK',
    );
  });

  it('falls back to the sendId from the widget link', async () => {
    client.fetch.mockResolvedValue(ok({ sendId: null }));
    await service.tick();
    expect(lastData().data.jarUrl).toBe(
      'https://send.monobank.ua/jar/6MJtUJ8B8d',
    );
  });

  it('closes the fundraiser and tells admins when the jar is closed', async () => {
    client.fetch.mockResolvedValue(ok({ closed: true }));
    await service.tick();
    expect(lastData().data.status).toBe(FundraiserStatus.CLOSED);
    expect(bot.notifyGroup).toHaveBeenCalledTimes(1);
    expect(bot.notifyGroup.mock.calls[0][0]).toContain('закрив банку');
  });

  it('stays silent when the admin changed the link during the request', async () => {
    client.fetch.mockResolvedValue(ok({ closed: true }));
    prisma.fundraiser.updateMany.mockResolvedValue({ count: 0 });
    await service.tick();
    expect(bot.notifyGroup).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid', { kind: 'invalid' }, 'банку не знайдено'],
    [
      'unsupported',
      { kind: 'unsupported', reason: 'Банка має бути в гривнях (UAH)' },
      'гривнях',
    ],
  ])('stops syncing a %s jar and alerts once', async (_, result, text) => {
    client.fetch.mockResolvedValue(result);
    await service.tick();
    expect(lastData()).toEqual({
      where: { id: 'f-1', jarWidgetUrl: WIDGET },
      data: { jarSyncError: expect.stringContaining(text) },
    });
    expect(bot.notifyGroup).toHaveBeenCalledTimes(1);
    expect(bot.notifyGroup.mock.calls[0][0]).toContain('Пікап');
  });

  it('marks a malformed stored link as broken without calling Monobank', async () => {
    prisma.fundraiser.findMany.mockResolvedValue([
      {
        ...FUNDRAISER,
        jarWidgetUrl: 'https://send.monobank.ua/jar/6MJtUJ8B8d',
      },
    ]);
    await service.tick();
    expect(client.fetch).not.toHaveBeenCalled();
    expect(lastData().data.jarSyncError).toContain('некоректне посилання');
    expect(bot.notifyGroup).toHaveBeenCalledTimes(1);
  });

  it('does not retry a jar sooner than every 5 minutes', async () => {
    client.fetch.mockResolvedValue({ kind: 'unavailable', reason: 'x' });
    await service.tick();
    advance(60_000);
    await service.tick();
    expect(client.fetch).toHaveBeenCalledTimes(1);
    advance(SYNC_EVERY_MS);
    await service.tick();
    expect(client.fetch).toHaveBeenCalledTimes(2);
  });

  it('alerts exactly once after 3 failures in a row and again on recovery', async () => {
    client.fetch.mockResolvedValue({
      kind: 'unavailable',
      reason: 'немає звʼязку з Monobank',
    });
    for (let i = 0; i < 5; i++) {
      await service.tick();
      advance(SYNC_EVERY_MS);
    }
    expect(client.fetch).toHaveBeenCalledTimes(5);
    expect(prisma.fundraiser.updateMany).not.toHaveBeenCalled();
    expect(bot.notifyGroup).toHaveBeenCalledTimes(1);
    expect(bot.notifyGroup.mock.calls[0][0]).toContain('3 спроби поспіль');

    client.fetch.mockResolvedValue(ok());
    await service.tick();
    expect(bot.notifyGroup).toHaveBeenCalledTimes(2);
    expect(bot.notifyGroup.mock.calls[1][0]).toContain('відновився');
  });

  it('does not report recovery when fewer than 3 failures happened', async () => {
    client.fetch.mockResolvedValueOnce({ kind: 'unavailable', reason: 'x' });
    await service.tick();
    advance(SYNC_EVERY_MS);
    client.fetch.mockResolvedValueOnce(ok());
    await service.tick();
    expect(bot.notifyGroup).not.toHaveBeenCalled();
  });

  it('backs off 5 → 10 → 20 → 30 min on 429 and alerts once at the cap', async () => {
    client.fetch.mockResolvedValue({ kind: 'rate-limited' });
    const pauses = [
      BACKOFF_START_MS,
      2 * BACKOFF_START_MS,
      4 * BACKOFF_START_MS,
      BACKOFF_MAX_MS,
      BACKOFF_MAX_MS,
    ];

    for (const pause of pauses) {
      await service.tick();
      const calls = client.fetch.mock.calls.length;
      advance(pause - 1_000);
      await service.tick();
      expect(client.fetch).toHaveBeenCalledTimes(calls);
      advance(1_000);
    }

    expect(client.fetch).toHaveBeenCalledTimes(pauses.length);
    expect(bot.notifyGroup).toHaveBeenCalledTimes(1);
    expect(bot.notifyGroup.mock.calls[0][0]).toContain('429');
    expect(prisma.fundraiser.updateMany).not.toHaveBeenCalled();
  });

  it('resets the backoff after a successful sync', async () => {
    client.fetch.mockResolvedValueOnce({ kind: 'rate-limited' });
    await service.tick();
    advance(BACKOFF_START_MS);
    client.fetch.mockResolvedValueOnce(ok());
    await service.tick();

    prisma.fundraiser.findMany.mockResolvedValue([
      { ...FUNDRAISER, id: 'f-2' },
    ]);
    client.fetch.mockResolvedValueOnce({ kind: 'rate-limited' });
    await service.tick();
    advance(BACKOFF_START_MS);
    client.fetch.mockResolvedValueOnce(ok());
    await service.tick();
    expect(client.fetch).toHaveBeenCalledTimes(4);
  });

  it('survives a failing admin notification', async () => {
    bot.notifyGroup.mockRejectedValue(new Error('telegram down'));
    client.fetch.mockResolvedValue({ kind: 'invalid' });
    await expect(service.tick()).resolves.toBeUndefined();
    expect(prisma.fundraiser.updateMany).toHaveBeenCalledTimes(1);
  });

  it('survives a database error and keeps working on the next tick', async () => {
    prisma.fundraiser.findMany.mockRejectedValueOnce(new Error('db down'));
    await expect(service.tick()).resolves.toBeUndefined();
    client.fetch.mockResolvedValue(ok());
    await service.tick();
    expect(client.fetch).toHaveBeenCalledTimes(1);
  });

  it('never runs two ticks at the same time', async () => {
    let release!: (r: JarFetchResult) => void;
    client.fetch.mockReturnValue(new Promise((r) => (release = r)));
    const first = service.tick();
    await Promise.resolve();
    await service.tick();
    release(ok());
    await first;
    expect(client.fetch).toHaveBeenCalledTimes(1);
  });
});
