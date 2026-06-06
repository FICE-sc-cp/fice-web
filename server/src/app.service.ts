import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'fice-api',
      timestamp: new Date().toISOString(),
    };
  }
}
