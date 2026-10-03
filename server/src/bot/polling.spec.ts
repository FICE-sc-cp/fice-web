import { PollingSupervisor, STABLE_RUN_MS } from './polling';

type Run = { resolve: () => void; reject: (err: unknown) => void };

function fakeBot() {
  const runs: Run[] = [];
  let running = false;
  const bot = {
    start: jest.fn(
      (options?: { onStart?: (info: unknown) => unknown }) =>
        new Promise<void>((resolve, reject) => {
          running = true;
          void options?.onStart?.({ username: 'test_bot' });
          runs.push({
            resolve: () => {
              running = false;
              resolve();
            },
            reject: (err) => {
              running = false;
              reject(err);
            },
          });
        }),
    ),
    stop: jest.fn(async () => {
      running = false;
      await Promise.resolve();
      runs.at(-1)?.resolve();
    }),
    isRunning: () => running,
  };
  return { bot, runs };
}

const flush = () =>
  new Promise((r) => jest.requireActual('timers').setImmediate(r));

describe('PollingSupervisor', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('restarts polling with growing back-off after a fatal error', async () => {
    const { bot, runs } = fakeBot();
    const logger = { error: jest.fn() };
    const supervisor = new PollingSupervisor(
      bot as never,
      logger,
      {},
      undefined,
      [1_000, 5_000],
    );

    supervisor.start();
    await flush();
    expect(supervisor.getStatus()).toBe('running');

    runs[0].reject(new Error('409: Conflict'));
    await flush();
    expect(supervisor.getStatus()).toBe('retrying');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('409: Conflict'),
    );

    jest.advanceTimersByTime(999);
    expect(bot.start).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    expect(bot.start).toHaveBeenCalledTimes(2);
    await flush();
    expect(supervisor.getStatus()).toBe('running');

    runs[1].reject(new Error('409: Conflict'));
    await flush();
    jest.advanceTimersByTime(4_999);
    expect(bot.start).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(1);
    expect(bot.start).toHaveBeenCalledTimes(3);
  });

  it('resets the back-off after a long stable run', async () => {
    const { bot, runs } = fakeBot();
    const supervisor = new PollingSupervisor(
      bot as never,
      { error: jest.fn() },
      {},
      undefined,
      [1_000, 5_000],
    );

    supervisor.start();
    await flush();
    runs[0].reject(new Error('boom'));
    await flush();
    jest.advanceTimersByTime(1_000);
    await flush();

    jest.advanceTimersByTime(STABLE_RUN_MS);
    runs[1].reject(new Error('boom'));
    await flush();
    jest.advanceTimersByTime(1_000);
    expect(bot.start).toHaveBeenCalledTimes(3);
  });

  it('does not restart after stop()', async () => {
    const { bot } = fakeBot();
    const supervisor = new PollingSupervisor(bot as never, {
      error: jest.fn(),
    });

    supervisor.start();
    await flush();
    await supervisor.stop();
    await flush();

    expect(bot.stop).toHaveBeenCalledTimes(1);
    expect(supervisor.getStatus()).toBe('stopped');
    jest.advanceTimersByTime(10 * 60_000);
    expect(bot.start).toHaveBeenCalledTimes(1);
  });
});
