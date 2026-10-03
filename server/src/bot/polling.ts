import type { Logger } from '@nestjs/common';
import type { Bot, PollingOptions } from 'grammy';

export type PollingStatus =
  | 'disabled'
  | 'starting'
  | 'running'
  | 'retrying'
  | 'stopped';

export const RESTART_DELAYS_MS = [
  5_000, 15_000, 30_000, 60_000, 120_000, 300_000,
];
export const STABLE_RUN_MS = 10 * 60_000;

type PollableBot = Pick<Bot, 'start' | 'stop' | 'isRunning'>;

export class PollingSupervisor {
  private status: PollingStatus = 'starting';
  private failures = 0;
  private runningSince?: number;
  private timer?: NodeJS.Timeout;
  private stopped = false;

  constructor(
    private readonly bot: PollableBot,
    private readonly logger: Pick<Logger, 'error'>,
    private readonly options: PollingOptions = {},
    private readonly describe: (err: unknown) => string = (err) =>
      err instanceof Error ? err.message : String(err),
    private readonly delays: number[] = RESTART_DELAYS_MS,
  ) {}

  getStatus(): PollingStatus {
    return this.status;
  }

  start(): void {
    if (this.stopped) return;
    this.status = 'starting';
    this.bot
      .start({
        ...this.options,
        onStart: async (botInfo) => {
          this.status = 'running';
          this.runningSince = Date.now();
          await this.options.onStart?.(botInfo);
        },
      })
      .then(
        () => this.onPollingEnded('polling ended unexpectedly'),
        (err: unknown) => this.onPollingEnded(this.describe(err)),
      );
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.status = 'stopped';
    if (this.bot.isRunning()) await this.bot.stop();
  }

  private onPollingEnded(reason: string): void {
    if (this.stopped) return;
    if (
      this.runningSince !== undefined &&
      Date.now() - this.runningSince >= STABLE_RUN_MS
    ) {
      this.failures = 0;
    }
    this.runningSince = undefined;
    const delay = this.delays[Math.min(this.failures, this.delays.length - 1)];
    this.failures++;
    this.status = 'retrying';
    this.logger.error(
      `Long polling stopped: ${reason}. Restarting in ${Math.round(delay / 1000)}s.`,
    );
    this.timer = setTimeout(() => this.start(), delay);
    this.timer.unref?.();
  }
}
