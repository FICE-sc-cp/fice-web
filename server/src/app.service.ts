import { Injectable } from '@nestjs/common';
import { BotService } from './bot/bot.service';
import { InterviewBotService } from './bot/interview-bot.service';
import { PollingStatus } from './bot/polling';
import { UserBotService } from './bot/user-bot.service';

export interface Health {
  status: 'ok' | 'degraded';
  service: string;
  timestamp: string;
  bots: { admin: PollingStatus; user: PollingStatus; interview: PollingStatus };
}

@Injectable()
export class AppService {
  constructor(
    private readonly botService: BotService,
    private readonly userBotService: UserBotService,
    private readonly interviewBotService: InterviewBotService,
  ) {}

  getHealth(): Health {
    const bots = {
      admin: this.botService.pollingStatus(),
      user: this.userBotService.pollingStatus(),
      interview: this.interviewBotService.pollingStatus(),
    };
    const degraded = Object.values(bots).includes('retrying');
    return {
      status: degraded ? 'degraded' : 'ok',
      service: 'fice-api',
      timestamp: new Date().toISOString(),
      bots,
    };
  }
}
