import { AppService } from './app.service';
import type { PollingStatus } from './bot/polling';

const serviceWith = (
  admin: PollingStatus,
  user: PollingStatus,
  interview: PollingStatus = 'disabled',
) =>
  new AppService(
    { pollingStatus: () => admin } as never,
    { pollingStatus: () => user } as never,
    { pollingStatus: () => interview } as never,
  );

describe('AppService.getHealth', () => {
  it('is ok when bots are running or not configured', () => {
    const health = serviceWith('running', 'disabled').getHealth();
    expect(health.status).toBe('ok');
    expect(health.bots).toEqual({
      admin: 'running',
      user: 'disabled',
      interview: 'disabled',
    });
  });

  it('is degraded while a bot is restarting its polling', () => {
    expect(serviceWith('running', 'retrying').getHealth().status).toBe(
      'degraded',
    );
    expect(
      serviceWith('running', 'running', 'retrying').getHealth().status,
    ).toBe('degraded');
  });
});
