import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { FundraiserService } from './fundraiser.service';

const CHECK_INTERVAL_MS = 15 * 60_000;
const FIRST_CHECK_DELAY_MS = 10_000;

@Injectable()
export class FundraiserScheduleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FundraiserScheduleService.name);
  private timer?: NodeJS.Timeout;
  private firstCheck?: NodeJS.Timeout;

  constructor(private readonly fundraisers: FundraiserService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), CHECK_INTERVAL_MS);
    this.firstCheck = setTimeout(() => void this.tick(), FIRST_CHECK_DELAY_MS);
    this.logger.log('Fundraiser auto-close enabled (15m interval).');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.firstCheck) clearTimeout(this.firstCheck);
  }

  private async tick() {
    try {
      const closed = await this.fundraisers.closeExpired();
      if (closed > 0) {
        this.logger.log(`Closed ${closed} expired fundraiser(s).`);
      }
    } catch (err) {
      this.logger.warn('Fundraiser auto-close failed: ' + String(err));
    }
  }
}
